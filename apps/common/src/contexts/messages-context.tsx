import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import type { Message } from '../types';
import { useAuth } from './auth-context';
import { useFirebase } from './firebase-context';

interface MessagesContextType {
  messages: Message[];
  isLoading: boolean;
  isLoadingEarlier: boolean;
  hasMoreMessages: boolean;
  error: string | null;
  updateMessageLocally: (messageId: string, updates: Partial<Message>) => void;
  loadEarlierMessages: () => Promise<void>;
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
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messagesLimit, setMessagesLimit] = useState(50); // Start with 50 messages

  // Function to update a message locally (in memory only, not in Firestore)
  const updateMessageLocally = (messageId: string, updates: Partial<Message>) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
    );
  };

  // Function to load earlier messages (pagination)
  const loadEarlierMessages = useCallback(async () => {
    if (!user || !sessionId || isLoadingEarlier || !hasMoreMessages) {
      return;
    }

    setIsLoadingEarlier(true);
    try {
      // Increase the limit to fetch more messages
      const newLimit = messagesLimit + 50;
      setMessagesLimit(newLimit);
    } catch (err) {
      console.error('Error loading earlier messages:', err);
      setError('Could not load earlier messages.');
      if (onError) {
        onError(new Error('Could not load earlier messages.'));
      }
    } finally {
      setIsLoadingEarlier(false);
    }
  }, [user, sessionId, isLoadingEarlier, hasMoreMessages, messagesLimit, onError]);

  useEffect(() => {
    if (!user || !sessionId) {
      setMessages([]);
      setIsLoading(false);
      setError(null);
      setHasMoreMessages(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    const messagesRef = collection(db, 'users', user.uid, 'chats', sessionId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(messagesLimit));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedMessages = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Message)
        );
        // Reverse to show oldest first (GiftedChat will reverse again to show newest at bottom)
        setMessages(loadedMessages.reverse());
        setIsLoading(false);

        // Check if there are more messages
        setHasMoreMessages(snapshot.docs.length >= messagesLimit);
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
  }, [user, sessionId, db, onError, messagesLimit]);

  return (
    <MessagesContext.Provider
      value={{
        messages,
        isLoading,
        isLoadingEarlier,
        hasMoreMessages,
        error,
        updateMessageLocally,
        loadEarlierMessages
      }}
    >
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
