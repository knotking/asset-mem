
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Session } from '@/lib/types';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';
import { createAgentSession } from '@/lib/api-agent';
import { createLogger } from '@/lib/logger';

const sessionLog = createLogger('session');

interface SessionContextType {
  sessionsByProperty: Record<string, Session[]>;
  draftsByProperty: Record<string, Session>;
  globalDraft: Session | null;
  isLoading: boolean;
  createGlobalDraftSession: (userId: string) => Promise<string | null>;
  createPropertyDraftSession: (userId: string, propertyId: string) => Promise<string | null>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessionsByProperty, setSessionsByProperty] = useState<Record<string, Session[]>>({});
  const [draftsByProperty, setDraftsByProperty] = useState<Record<string, Session>>({});
  const [globalDraft, setGlobalDraft] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const createAgentSessionForUser = useCallback(async (userId: string): Promise<string | null> => {
    const { agentSessionId, error } = await createAgentSession(userId);
    if (error || !agentSessionId) {
      throw new Error(error || 'Failed to create agent session ID.');
    }
    return agentSessionId;
  }, []);

  const createGlobalDraftSession = useCallback(async (userId: string) => {
    try {
      const agentSessionId = await createAgentSessionForUser(userId);
      if (!agentSessionId) return null;
      
      const docRef = await addDoc(collection(db, 'users', userId, 'chats'), {
        name: 'draft',
        createdAt: serverTimestamp(),
        agentSessionId: agentSessionId,
        propertyId: null, // Global draft
      });
      return docRef.id;
    } catch (err) {
      sessionLog.error('draft.global.failed', undefined, err);
      // Don't show a toast for this background task
      return null;
    }
  }, [createAgentSessionForUser]);
  
  const createPropertyDraftSession = useCallback(async (userId: string, propertyId: string) => {
    try {
      const agentSessionId = await createAgentSessionForUser(userId);
      if (!agentSessionId) return null;
      
      const docRef = await addDoc(collection(db, 'users', userId, 'chats'), {
        name: 'draft',
        createdAt: serverTimestamp(),
        agentSessionId: agentSessionId,
        propertyId: propertyId,
      });
      return docRef.id;
    } catch (err) {
      sessionLog.error('draft.property.failed', { propertyId }, err);
      return null;
    }
  }, [createAgentSessionForUser]);

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
        sessionLog.error("sessions.subscribe.failed", undefined, error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load chat sessions.' });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast, createGlobalDraftSession, createPropertyDraftSession]);

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
