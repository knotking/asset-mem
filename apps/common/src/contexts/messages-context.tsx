import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import type { Message } from '../types';
import { useAuth } from './auth-context';
import { useFirebase } from './firebase-context';

interface MessagesContextType {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  updateMessageLocally: (messageId: string, updates: Partial<Message>) => void;
}

interface MessagesProviderProps {
  children: React.ReactNode;
  sessionId: string | null;
  onError?: (error: Error) => void;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export const MessagesProvider = ({ children, sessionId, onError }: MessagesProviderProps) => {
  const { user } = useAuth();
  const { db } = useFirebase();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to update a message locally (in memory only, not in Firestore)
  const updateMessageLocally = (messageId: string, updates: Partial<Message>) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
    );
  };

  useEffect(() => {
    if (!user || !sessionId) {
      setMessages([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const messagesRef = collection(db, 'users', user.uid, 'chats', sessionId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedMessages = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Message)
        );
        setMessages(loadedMessages);
        setIsLoading(false);
      },
      (err) => {
        console.error('Messages context error:', err);
        setError('Could not load messages.');
        setIsLoading(false);
        if (onError) {
          onError(new Error('Could not load messages.'));
        }
      }
    );

    return () => unsubscribe();
  }, [user, sessionId, db, onError]);

  return (
    <MessagesContext.Provider value={{ messages, isLoading, error, updateMessageLocally }}>
      {children}
    </MessagesContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
};
