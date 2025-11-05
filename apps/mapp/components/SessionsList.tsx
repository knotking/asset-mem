import React, { useState } from 'react';
import { View, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, MoreVertical, Share2, Trash2, Copy, Loader2 } from 'lucide-react-native';
import type { Session, Message } from '@homeapp/common/types';
import { useSession } from '@homeapp/common/contexts/session-context';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteCollection } from '@/lib/utils';
import { deleteAgentSession, WEB_APP_URL } from '@/lib/api';
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  addDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';

interface SessionsListProps {
  propertyId: string;
  onSessionPress?: (session: Session) => void;
  onCreateSession?: () => void;
}

type ShareState = 'idle' | 'checking' | 'prompt_update' | 'creating' | 'updating' | 'done';

export default function SessionsList({
  propertyId,
  onSessionPress,
  onCreateSession,
}: SessionsListProps) {
  const { sessionsByProperty, draftsByProperty, isLoading, createPropertyDraftSession } = useSession();
  const { user } = useAuth();
  const { db } = useFirebase();

  // Delete dialog state
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);

  // Share dialog state
  const [sessionToShare, setSessionToShare] = useState<Session | null>(null);
  const [shareState, setShareState] = useState<ShareState>('idle');
  const [sharedLink, setSharedLink] = useState<string | null>(null);
  const [existingShareId, setExistingShareId] = useState<string | null>(null);

  // Alert dialog state
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const sessions = sessionsByProperty[propertyId] || [];
  const draftSession = draftsByProperty[propertyId];
  // Draft sessions are hidden from the list (similar to webapp)
  // They are auto-selected on property load and transition to regular sessions on first message

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  };

  const handleCreateSession = async () => {
    if (!user) return;

    // Claim existing draft or create new one (same as webapp)
    if (draftSession) {
      // Draft exists - claim it by selecting it
      onSessionPress?.(draftSession);
    } else {
      // No draft exists - create one
      const newSessionId = await createPropertyDraftSession(user.uid, propertyId);
      if (newSessionId) {
        // The draft will be picked up by the context and auto-selected
        // In parallel, a new draft will be created for future use
      }
    }

    // Call the onCreateSession callback if provided
    if (onCreateSession) {
      onCreateSession();
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete || !user) return;

    const sessionToDeleteCache = sessionToDelete;
    setSessionToDelete(null);

    try {
      const sessionRef = doc(db, 'users', user.uid, 'chats', sessionToDeleteCache.id);
      const messagesColRef = collection(db, 'users', user.uid, 'chats', sessionToDeleteCache.id, 'messages');

      // Delete agent session from backend if it exists
      if (sessionToDeleteCache.agentSessionId) {
        deleteAgentSession(user.uid, sessionToDeleteCache.agentSessionId).catch((error) => {
          console.error('Failed to delete agent session from backend:', error);
        });
      }

      // Delete all messages in the session
      await deleteCollection(db, messagesColRef);
      // Delete the session document
      await deleteDoc(sessionRef);

      showAlert('Success', 'Chat session deleted successfully');
    } catch (error) {
      console.error('Error deleting session:', error);
      showAlert('Error', 'Could not delete the chat session. Please try again.');
    }
  };

  const handleOpenShareDialog = (session: Session) => {
    setSessionToShare(session);
    setShareState('idle');
    setSharedLink(null);
    setExistingShareId(null);
  };

  const handleCloseShareDialog = () => {
    if (shareState === 'creating' || shareState === 'updating' || shareState === 'checking') return;
    setSessionToShare(null);
    setTimeout(() => {
      setShareState('idle');
      setSharedLink(null);
      setExistingShareId(null);
    }, 300);
  };

  const checkForExistingShare = async () => {
    if (!user || !sessionToShare) return;
    setShareState('checking');
    try {
      const sharedChatsRef = collection(db, 'sharedChats');
      const q = query(
        sharedChatsRef,
        where('originalUserId', '==', user.uid),
        where('originalSessionId', '==', sessionToShare.id),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        setExistingShareId(existingDoc.id);
        setSharedLink(`${WEB_APP_URL}/share/${existingDoc.id}`);
        setShareState('prompt_update');
      } else {
        // No existing share found, proceed to create
        await performShareAction(false);
      }
    } catch (error) {
      showAlert('Error', 'Could not check for existing share link.');
      setShareState('idle');
    }
  };

  const performShareAction = async (isUpdating: boolean) => {
    if (!user || !sessionToShare) return;

    setShareState(isUpdating ? 'updating' : 'creating');

    try {
      // Fetch original session and messages
      const sessionRef = doc(db, 'users', user.uid, 'chats', sessionToShare.id);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) throw new Error('Original session not found.');

      const messagesRef = collection(sessionRef, 'messages');
      const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));
      const messagesSnap = await getDocs(messagesQuery);

      const messages = messagesSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        };
      });

      let shareId: string;

      if (isUpdating && existingShareId) {
        shareId = existingShareId;
        const sharedChatRef = doc(db, 'sharedChats', shareId);
        const sharedMessagesRef = collection(sharedChatRef, 'messages');

        // Delete old messages
        await deleteCollection(db, sharedMessagesRef);

        // Add new messages
        const batch = writeBatch(db);
        messages.forEach((message) => {
          const messageRef = doc(sharedMessagesRef);
          batch.set(messageRef, message);
        });
        await batch.commit();

        // Update the updatedAt timestamp on the parent doc
        await updateDoc(sharedChatRef, { updatedAt: serverTimestamp() });
      } else {
        const sessionData = sessionSnap.data();
        const sharedChatsRef = collection(db, 'sharedChats');
        const newSharedChatRef = await addDoc(sharedChatsRef, {
          originalUserId: user.uid,
          originalSessionId: sessionToShare.id,
          name: sessionData.name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          propertyId: sessionData.propertyId || null,
        });
        shareId = newSharedChatRef.id;

        const batch = writeBatch(db);
        const sharedMessagesRef = collection(newSharedChatRef, 'messages');
        messages.forEach((message) => {
          const messageRef = doc(sharedMessagesRef);
          batch.set(messageRef, message);
        });
        await batch.commit();
      }

      setSharedLink(`${WEB_APP_URL}/share/${shareId}`);
      setShareState('done');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      showAlert('Error Sharing', `Could not share the session. ${errorMessage}`);
      setShareState('idle');
    }
  };

  const handleCopyLink = async () => {
    if (sharedLink) {
      await Clipboard.setStringAsync(sharedLink);
      showAlert('Success', 'Link copied to clipboard!');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Create New Session Button */}
      <View className="p-4">
        <Button
          onPress={handleCreateSession}
          variant="default"
          className="flex-row items-center gap-2">
          <Icon as={Plus} size={20} className="text-primary-foreground" />
          <Text className="text-primary-foreground">New Session</Text>
        </Button>
      </View>

      {/* Sessions List */}
      <ScrollView className="flex-1 px-4">
        {sessions.length === 0 ? (
          <View className="items-center py-8">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Icon as={MessageSquare} size={32} className="text-muted-foreground" />
            </View>
            <Text className="text-center text-sm text-muted-foreground">
              No sessions yet. Create one to start chatting about this property.
            </Text>
          </View>
        ) : (
          <View className="gap-4 pb-4">
            {/* Regular Sessions - Draft sessions are hidden */}
            {sessions.map((session) => (
              <View
                key={session.id}
                className="rounded-lg border border-border bg-card p-4">
                <View className="flex-row items-start gap-3">
                  <Pressable
                    onPress={() => onSessionPress?.(session)}
                    className="flex-1 flex-row items-start gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-success/10">
                      <Icon as={MessageSquare} size={20} className="text-success" />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="text-base font-semibold text-foreground">{session.name}</Text>
                      <Text className="text-xs text-muted-foreground">
                        {formatDate(session.createdAt)}
                      </Text>
                      {session.messageCount !== undefined && session.messageCount > 0 && (
                        <Text className="text-xs text-muted-foreground">
                          {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                        </Text>
                      )}
                      {session.lastMessageAt && (
                        <Text className="text-xs text-muted-foreground">
                          Last active: {formatDate(session.lastMessageAt)}
                        </Text>
                      )}
                    </View>
                  </Pressable>

                  {/* Dropdown Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Icon as={MoreVertical} size={20} className="text-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onPress={() => handleOpenShareDialog(session)}>
                        <Icon as={Share2} size={20} className="text-foreground" />
                        <Text>Share</Text>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onPress={() => setSessionToDelete(session)}>
                        <Icon as={Trash2} size={20} />
                        <Text>Delete</Text>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the chat session "{sessionToDelete?.name}" and all of its
              messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text className="text-sm">Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDeleteSession}>
              <Text className="text-sm text-destructive-foreground">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Dialog */}
      <Dialog open={!!sessionToShare} onOpenChange={(open) => !open && handleCloseShareDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Chat Session</DialogTitle>
            <DialogDescription>
              {shareState === 'done'
                ? 'Anyone with this link can view a read-only version of this chat.'
                : shareState === 'prompt_update'
                  ? 'A shared link already exists for this chat. You can update it with the latest messages.'
                  : `Create a public, read-only link for "${sessionToShare?.name}"?`}
            </DialogDescription>
          </DialogHeader>

          <View className="min-h-[60px] justify-center">
            {shareState === 'done' ? (
              <View className="flex-col gap-2 pt-2">
                <View className="max-w-full overflow-hidden rounded-md border border-border bg-muted px-3 py-2">
                  <Text
                    className="text-sm text-foreground"
                    numberOfLines={2}
                    ellipsizeMode="middle">
                    {sharedLink}
                  </Text>
                </View>
                <Button onPress={handleCopyLink} size="sm" className="flex-row items-center gap-2">
                  <Icon as={Copy} size={16} className="text-primary-foreground" />
                  <Text className="text-sm text-primary-foreground">Copy Link</Text>
                </Button>
              </View>
            ) : shareState === 'prompt_update' ? (
              <DialogFooter>
                <Button
                  variant="outline"
                  onPress={() => performShareAction(false)}>
                  <Text className="text-sm">Create New Link</Text>
                </Button>
                <Button
                  onPress={() => performShareAction(true)}>
                  <Text className="text-sm text-primary-foreground">Update Existing Link</Text>
                </Button>
              </DialogFooter>
            ) : (
              <DialogFooter>
                <Button variant="outline" onPress={handleCloseShareDialog}>
                  <Text className="text-sm">Cancel</Text>
                </Button>
                <Button
                  onPress={checkForExistingShare}
                  disabled={shareState !== 'idle'}
                  className="flex-row items-center gap-2">
                  {(shareState === 'checking' || shareState === 'creating') && (
                    <Icon as={Loader2} size={16} className="text-primary-foreground" />
                  )}
                  <Text className="text-sm text-primary-foreground">Create public link</Text>
                </Button>
              </DialogFooter>
            )}
          </View>
        </DialogContent>
      </Dialog>

      {/* General Alert Dialog */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
            <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setAlertOpen(false)}>
              <Text className="text-sm">OK</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
