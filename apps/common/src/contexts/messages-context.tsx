import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import type { Message } from '../types';
import { useAuth } from './auth-context';
import { useFirebase } from './firebase-context';
import { createLogger } from '../lib/logger';
import { mergeMessagesFromSnapshot } from '../lib/merge-messages-snapshot';
import { sortMessagesChronologically } from '../lib/sort-messages';

const messagesLog = createLogger('messages');

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
  const prevMessagesRef = useRef<Message[]>([]);

  // Function to update a message locally (in memory only, not in Firestore)
  const updateMessageLocally = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages((prevMessages) => {
      const next = prevMessages.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
      prevMessagesRef.current = next;
      return next;
    });
  }, []);

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
      messagesLog.error('messages.loadEarlier.failed', undefined, err);
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
      prevMessagesRef.current = [];
      setMessages([]);
      setIsLoading(false);
      setError(null);
      setHasMoreMessages(true);
      return;
    }

    prevMessagesRef.current = [];
    setMessages([]);
    setIsLoading(true);
    setError(null);

    const messagesCollection = collection(db, 'users', user.uid, 'chats', sessionId, 'messages');
    const q = query(messagesCollection, orderBy('createdAt', 'desc'), limit(messagesLimit));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedMessages = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Message)
        );
        // Reverse to oldest first, then stabilize user-before-assistant on timestamp ties.
        const ordered = sortMessagesChronologically(loadedMessages.reverse());
        const merged = mergeMessagesFromSnapshot(prevMessagesRef.current, ordered);
        prevMessagesRef.current = merged;
        setMessages(merged);
        setIsLoading(false);

        // Check if there are more messages
        setHasMoreMessages(snapshot.docs.length >= messagesLimit);
      },
      (err) => {
        messagesLog.error('messages.subscribe.failed', undefined, err);
        setError('Could not load messages.');
        setIsLoading(false);
        if (onError) {
          onError(new Error('Could not load messages.'));
        }
      }
    );

    return () => unsubscribe();
  }, [user, sessionId, db, onError, messagesLimit]);

  const contextValue = useMemo(
    () => ({
      messages,
      isLoading,
      isLoadingEarlier,
      hasMoreMessages,
      error,
      updateMessageLocally,
      loadEarlierMessages,
    }),
    [
      messages,
      isLoading,
      isLoadingEarlier,
      hasMoreMessages,
      error,
      updateMessageLocally,
      loadEarlierMessages,
    ]
  );

  return <MessagesContext.Provider value={contextValue}>{children}</MessagesContext.Provider>;
};

export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
};
