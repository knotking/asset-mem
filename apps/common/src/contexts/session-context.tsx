import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Session } from '../types';
import { useAuth } from './auth-context';
import { useFirebase } from './firebase-context';

interface SessionContextType {
  sessionsByProperty: Record<string, Session[]>;
  draftsByProperty: Record<string, Session>;
  globalDraft: Session | null;
  isLoading: boolean;
  createGlobalDraftSession: (userId: string) => Promise<string | null>;
  createPropertyDraftSession: (userId: string, propertyId: string) => Promise<string | null>;
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

  const createAgentSession = useCallback(async (userId: string): Promise<string | null> => {
    const { agentSessionId, error } = await createAgentSessionFn(userId);
    if (error || !agentSessionId) {
      throw new Error(error || 'Failed to create agent session ID.');
    }
    return agentSessionId;
  }, [createAgentSessionFn]);

  const createGlobalDraftSession = useCallback(async (userId: string) => {
    try {
      const agentSessionId = await createAgentSession(userId);
      if (!agentSessionId) return null;
      
      const docRef = await addDoc(collection(db, 'users', userId, 'chats'), {
        name: 'draft',
        createdAt: serverTimestamp(),
        agentSessionId: agentSessionId,
        propertyId: null, // Global draft
      });
      return docRef.id;
    } catch (err) {
      console.error(`Failed to pre-create global draft session:`, err);
      // Don't show a toast for this background task
      return null;
    }
  }, [createAgentSession]);
  
  const createPropertyDraftSession = useCallback(async (userId: string, propertyId: string) => {
    try {
      const agentSessionId = await createAgentSession(userId);
      if (!agentSessionId) return null;
      
      const docRef = await addDoc(collection(db, 'users', userId, 'chats'), {
        name: 'draft',
        createdAt: serverTimestamp(),
        agentSessionId: agentSessionId,
        propertyId: propertyId,
      });
      return docRef.id;
    } catch (err) {
      console.error(`Failed to create draft for property ${propertyId}:`, err);
      return null;
    }
  }, [createAgentSession]);

  useEffect(() => {
    if (!user) {
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
      const propertyIdsWithDrafts = new Set<string>();

      allSessions.forEach(session => {
        if (session.name === 'draft') {
          if (session.propertyId) {
            newDraftsByProperty[session.propertyId] = session;
            propertyIdsWithDrafts.add(session.propertyId);
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
      
      setGlobalDraft(foundGlobalDraft);
      setSessionsByProperty(newSessionsByProperty);
      setDraftsByProperty(newDraftsByProperty);
      setIsLoading(false);

      // Eagerly create missing drafts
      if (!foundGlobalDraft) {
        createGlobalDraftSession(user.uid);
      }
      
      // We need to know all properties to check if a draft is missing.
      // For now, we assume if a property has sessions, it should have a draft.
      Object.keys(newSessionsByProperty).forEach(propId => {
        if (!propertyIdsWithDrafts.has(propId)) {
          createPropertyDraftSession(user.uid, propId);
        }
      });

    }, (error) => {
        console.error("Session context error:", error);
        if (onError) {
          onError(new Error('Could not load chat sessions.'));
        }
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, onError, createGlobalDraftSession, createPropertyDraftSession]);

  return (
    <SessionContext.Provider value={{ sessionsByProperty, draftsByProperty, globalDraft, isLoading, createGlobalDraftSession, createPropertyDraftSession }}>
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
