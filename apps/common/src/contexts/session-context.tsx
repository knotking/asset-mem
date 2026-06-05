import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDocs,
  limit,
} from 'firebase/firestore';
import type { Session } from '../types';
import { useAuth } from './auth-context';
import { useFirebase } from './firebase-context';
import { createLogger, truncateId } from '../lib/logger';
import {
  deriveSessionNameFromFirstMessage,
  messageTextForSessionName,
} from '../lib/session-name';
import { clientStartedAtTimestamp } from '../lib/session-timestamps';

const sessionLog = createLogger('session');

type DraftSource = 'eager' | 'caller';

function draftInflightKey(propertyId?: string | null): string {
  return propertyId ? `property:${propertyId}` : 'global';
}

interface SessionContextType {
  sessionsByProperty: Record<string, Session[]>;
  draftsByProperty: Record<string, Session>;
  globalDraft: Session | null;
  isLoading: boolean;
  createGlobalDraftSession: (userId: string) => Promise<string | null>;
  createPropertyDraftSession: (userId: string, propertyId: string) => Promise<string | null>;
  beginNewPropertyChatSession: (
    userId: string,
    propertyId: string,
    currentSessionId?: string | null
  ) => Promise<string | null>;
}

interface SessionProviderProps {
  children: React.ReactNode;
  createAgentSession: (userId: string) => Promise<{ agentSessionId?: string; error?: string }>;
  onError?: (error: Error) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children, createAgentSession: createAgentSessionFn, onError }: SessionProviderProps) => {
  const { user } = useAuth();
  const { db } = useFirebase();
  const [sessionsByProperty, setSessionsByProperty] = useState<Record<string, Session[]>>({});
  const [draftsByProperty, setDraftsByProperty] = useState<Record<string, Session>>({});
  const [globalDraft, setGlobalDraft] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const draftCreationByKeyRef = useRef(new Map<string, Promise<string | null>>());

  const createAgentSession = useCallback(async (userId: string): Promise<string | null> => {
    const { agentSessionId, error } = await createAgentSessionFn(userId);
    if (error || !agentSessionId) {
      throw new Error(error || 'Failed to create agent session ID.');
    }
    return agentSessionId;
  }, [createAgentSessionFn]);

  const createDraftSessionInternal = useCallback(
    async (
      userId: string,
      propertyId: string | null,
      source: DraftSource
    ): Promise<string | null> => {
      const key = draftInflightKey(propertyId);
      const inFlight = draftCreationByKeyRef.current.get(key);
      if (inFlight) {
        sessionLog.debug('draft.create.join', { key, source });
        return inFlight;
      }

      sessionLog.debug('draft.create.start', { key, source });

      const work = (async (): Promise<string | null> => {
        try {
          const agentSessionId = await createAgentSession(userId);
          if (!agentSessionId) return null;

          const docRef = await addDoc(collection(db, 'users', userId, 'chats'), {
            name: 'draft',
            createdAt: serverTimestamp(),
            agentSessionId,
            propertyId,
          });

          sessionLog.debug('draft.create.done', {
            key,
            source,
            sessionId: truncateId(docRef.id),
          });
          return docRef.id;
        } catch (err) {
          sessionLog.error(
            propertyId ? 'draft.property.failed' : 'draft.global.failed',
            { propertyId: propertyId ?? undefined, source },
            err
          );
          return null;
        } finally {
          draftCreationByKeyRef.current.delete(key);
        }
      })();

      draftCreationByKeyRef.current.set(key, work);
      return work;
    },
    [createAgentSession, db]
  );

  const createGlobalDraftSession = useCallback(
    (userId: string) => createDraftSessionInternal(userId, null, 'caller'),
    [createDraftSessionInternal]
  );

  const createPropertyDraftSession = useCallback(
    (userId: string, propertyId: string) =>
      createDraftSessionInternal(userId, propertyId, 'caller'),
    [createDraftSessionInternal]
  );

  const sessionHasMessages = useCallback(
    async (userId: string, sessionId: string): Promise<boolean> => {
      const messagesSnap = await getDocs(
        query(
          collection(db, 'users', userId, 'chats', sessionId, 'messages'),
          limit(1)
        )
      );
      return !messagesSnap.empty;
    },
    [db]
  );

  const resolveClaimedSessionName = useCallback(
    async (userId: string, sessionId: string): Promise<string> => {
      const messagesSnap = await getDocs(
        query(
          collection(db, 'users', userId, 'chats', sessionId, 'messages'),
          orderBy('createdAt', 'asc'),
          limit(20)
        )
      );
      for (const messageDoc of messagesSnap.docs) {
        const data = messageDoc.data();
        if (data.role !== 'user') continue;
        return deriveSessionNameFromFirstMessage(messageTextForSessionName(data));
      }
      return deriveSessionNameFromFirstMessage('');
    },
    [db]
  );

  const claimDraftSession = useCallback(
    async (userId: string, propertyId: string, draftId: string): Promise<void> => {
      sessionLog.debug('draft.claim', {
        propertyId: truncateId(propertyId),
        sessionId: truncateId(draftId),
      });
      const name = await resolveClaimedSessionName(userId, draftId);
      await updateDoc(doc(db, 'users', userId, 'chats', draftId), {
        name,
        propertyId,
        startedAt: clientStartedAtTimestamp(),
      });
    },
    [db, resolveClaimedSessionName]
  );

  const beginNewPropertyChatSession = useCallback(
    async (
      userId: string,
      propertyId: string,
      currentSessionId?: string | null
    ): Promise<string | null> => {
      const draft = draftsByProperty[propertyId];

      if (draft && currentSessionId === draft.id) {
        const hasMessages = await sessionHasMessages(userId, draft.id);
        if (!hasMessages) {
          sessionLog.debug('draft.begin.noop', {
            propertyId: truncateId(propertyId),
            reason: 'already_on_empty_draft',
          });
          return draft.id;
        }
        await claimDraftSession(userId, propertyId, draft.id);
        sessionLog.debug('draft.begin.create_after_claim', {
          propertyId: truncateId(propertyId),
        });
        return createPropertyDraftSession(userId, propertyId);
      }

      if (draft) {
        sessionLog.debug('draft.begin.select', {
          propertyId: truncateId(propertyId),
          sessionId: truncateId(draft.id),
          currentSessionId: truncateId(currentSessionId ?? undefined),
        });
        return draft.id;
      }

      sessionLog.debug('draft.begin.create', { propertyId: truncateId(propertyId) });
      return createPropertyDraftSession(userId, propertyId);
    },
    [
      draftsByProperty,
      sessionHasMessages,
      claimDraftSession,
      createPropertyDraftSession,
    ]
  );

  useEffect(() => {
    if (!user) {
      draftCreationByKeyRef.current.clear();
      setSessionsByProperty({});
      setDraftsByProperty({});
      setGlobalDraft(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const chatsRef = collection(db, 'users', user.uid, 'chats');
    const q = query(chatsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSessions = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Session));
      
      const newSessionsByProperty: Record<string, Session[]> = {};
      const newDraftsByProperty: Record<string, Session> = {};
      let foundGlobalDraft: Session | null = null;

      allSessions.forEach(session => {
        if (session.name === 'draft') {
          if (session.propertyId) {
            newDraftsByProperty[session.propertyId] = session;
          } else {
            foundGlobalDraft = session;
          }
        } else if (session.propertyId) {
            if (!newSessionsByProperty[session.propertyId]) {
                newSessionsByProperty[session.propertyId] = [];
            }
            newSessionsByProperty[session.propertyId].push(session);
        }
      });
      
      const getTimestampValue = (value: any): number => {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = Date.parse(value);
          return Number.isNaN(parsed) ? 0 : parsed;
        }
        if (value instanceof Date) return value.getTime();
        if (typeof value.toMillis === 'function') return value.toMillis();
        if (typeof value.toDate === 'function') {
          const date = value.toDate();
          return date instanceof Date ? date.getTime() : 0;
        }
        return 0;
      };

      Object.keys(newSessionsByProperty).forEach(propId => {
        newSessionsByProperty[propId].sort((a, b) => {
          const bTime = getTimestampValue(b.lastMessageAt ?? b.startedAt ?? b.createdAt);
          const aTime = getTimestampValue(a.lastMessageAt ?? a.startedAt ?? a.createdAt);
          return bTime - aTime;
        });
      });
      
      setGlobalDraft(foundGlobalDraft);
      setSessionsByProperty(newSessionsByProperty);
      setDraftsByProperty(newDraftsByProperty);
      setIsLoading(false);
    }, (error) => {
        sessionLog.error("sessions.subscribe.failed", undefined, error);
        if (onError) {
          onError(new Error('Could not load chat sessions.'));
        }
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, db, onError]);

  useEffect(() => {
    if (!user || isLoading) return;

    if (!globalDraft) {
      sessionLog.debug('draft.eager.global', { userId: truncateId(user.uid) });
      void createDraftSessionInternal(user.uid, null, 'eager');
    }

    Object.keys(sessionsByProperty).forEach(propId => {
      if (!draftsByProperty[propId]) {
        sessionLog.debug('draft.eager.property', { propertyId: truncateId(propId) });
        void createDraftSessionInternal(user.uid, propId, 'eager');
      }
    });
  }, [user, isLoading, globalDraft, draftsByProperty, sessionsByProperty, createDraftSessionInternal]);

  return (
    <SessionContext.Provider value={{ sessionsByProperty, draftsByProperty, globalDraft, isLoading, createGlobalDraftSession, createPropertyDraftSession, beginNewPropertyChatSession }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
