import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, MoreVertical, Share2, Trash2, Copy, Loader2, Pencil } from 'lucide-react-native';
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
import { deleteCollection, cn } from '@/lib/utils';
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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [sessionBeingRenamed, setSessionBeingRenamed] = useState<Session | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const selectedCount = selectedSessionIds.length;
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedSessionIds([]);
  }, []);
  useEffect(() => {
    setSearchTerm('');
    exitSelectionMode();
    setRenameDialogOpen(false);
    setSessionBeingRenamed(null);
    setRenameValue('');
    setIsRenaming(false);
  }, [propertyId, exitSelectionMode]);
  const filteredSessions = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
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

    const base = normalizedTerm
      ? sessions.filter((session) => session.name?.toLowerCase().includes(normalizedTerm))
      : sessions;

    return [...base].sort((a, b) => {
      const bTime = getTimestampValue(b.lastMessageAt ?? b.createdAt);
      const aTime = getTimestampValue(a.lastMessageAt ?? a.createdAt);
      return bTime - aTime;
    });
  }, [sessions, searchTerm]);
  useEffect(() => {
    setSelectedSessionIds((prev) => {
      const filtered = prev.filter((id) => sessions.some((session) => session.id === id));
      // Only update if the filtered array is different to prevent infinite loops
      return filtered.length !== prev.length ? filtered : prev;
    });
  }, [sessions]);
  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedSessionIds.includes(session.id)),
    [sessions, selectedSessionIds]
  );
  const isAllSelected = filteredSessions.length > 0 && selectedCount === filteredSessions.length;
  const trimmedRenameValue = renameValue.trim();
  const isRenameDisabled =
    isRenaming || !trimmedRenameValue || trimmedRenameValue === sessionBeingRenamed?.name;

  const toggleSessionSelection = useCallback((sessionId: string) => {
    setSelectedSessionIds((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedSessionIds([]);
      return;
    }
    setSelectedSessionIds(filteredSessions.map((session) => session.id));
  }, [filteredSessions, isAllSelected]);

  const handleToggleSelectionMode = useCallback(() => {
    if (isSelectionMode) {
      exitSelectionMode();
    } else {
      setIsSelectionMode(true);
    }
  }, [exitSelectionMode, isSelectionMode]);

  const showAlert = useCallback((title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  }, []);

  const handleOpenRenameDialog = useCallback((session: Session) => {
    if (isSelectionMode) {
      exitSelectionMode();
    }
    setSessionBeingRenamed(session);
    setRenameValue(session.name ?? '');
    setRenameDialogOpen(true);
  }, [exitSelectionMode, isSelectionMode]);

  const handleRenameDialogClose = useCallback(() => {
    if (isRenaming) return;
    setRenameDialogOpen(false);
    setSessionBeingRenamed(null);
    setRenameValue('');
  }, [isRenaming]);

  const handleSubmitRename = useCallback(async () => {
    if (!user || !sessionBeingRenamed) return;
    const trimmedName = renameValue.trim();
    if (!trimmedName || trimmedName === sessionBeingRenamed.name) {
      setRenameDialogOpen(false);
      setSessionBeingRenamed(null);
      setRenameValue('');
      return;
    }

    setIsRenaming(true);
    try {
      const sessionRef = doc(db, 'users', user.uid, 'chats', sessionBeingRenamed.id);
      await updateDoc(sessionRef, { name: trimmedName, updatedAt: serverTimestamp() });
      showAlert('Success', 'Chat session renamed successfully.');
      setRenameDialogOpen(false);
      setSessionBeingRenamed(null);
      setRenameValue('');
    } catch (error) {
      console.error('Error renaming session:', error);
      showAlert('Error', 'Could not rename the chat session. Please try again.');
    } finally {
      setIsRenaming(false);
    }
  }, [db, renameValue, sessionBeingRenamed, showAlert, user]);

  const handleBulkDeleteSessions = useCallback(async () => {
    if (!user || selectedSessions.length === 0) return;

    setIsBulkDeleting(true);
    try {
      for (const sessionItem of selectedSessions) {
        const sessionRef = doc(db, 'users', user.uid, 'chats', sessionItem.id);
        const messagesColRef = collection(db, 'users', user.uid, 'chats', sessionItem.id, 'messages');

        if (sessionItem.agentSessionId) {
          try {
            await deleteAgentSession(user.uid, sessionItem.agentSessionId);
          } catch (error) {
            console.error('Failed to delete agent session from backend:', error);
          }
        }

        await deleteCollection(db, messagesColRef);
        await deleteDoc(sessionRef);
      }

      showAlert(
        'Success',
        `${selectedSessions.length} chat session${selectedSessions.length === 1 ? '' : 's'} deleted successfully.`
      );
      exitSelectionMode();
    } catch (error) {
      console.error('Error deleting sessions:', error);
      showAlert('Error', 'Could not delete the selected chat sessions. Please try again.');
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteOpen(false);
    }
  }, [user, selectedSessions, db, deleteAgentSession, exitSelectionMode, showAlert]);
  const draftSession = draftsByProperty[propertyId];
  // Draft sessions are hidden from the list (similar to webapp)
  // They are auto-selected on property load and transition to regular sessions on first message

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
      <View className="p-4 gap-3">
        <Input
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search sessions"
          accessibilityLabel="Search sessions by issue name"
          returnKeyType="search"
          className="bg-background border border-border text-foreground px-3 py-2 rounded-lg"
        />
        <View className="flex-row flex-wrap items-center gap-2">
          <Button
            onPress={handleCreateSession}
            variant="default"
            className="flex-row items-center gap-2"
            disabled={isSelectionMode}>
            <Icon as={Plus} size={20} className="text-primary-foreground" />
            <Text className="text-primary-foreground">New Session</Text>
          </Button>
          <Button
            variant={isSelectionMode ? 'secondary' : 'outline'}
            className="flex-row items-center gap-2"
            onPress={handleToggleSelectionMode}
            disabled={filteredSessions.length === 0}>
            <Text className="text-sm text-foreground">
              {isSelectionMode ? 'Cancel' : 'Select'}
            </Text>
          </Button>
          {isSelectionMode && (
            <>
              <Button
                variant="outline"
                className="flex-row items-center gap-2"
                onPress={handleSelectAll}>
                <Text className="text-sm text-foreground">
                  {isAllSelected ? 'Clear all' : 'Select all'}
                </Text>
              </Button>
              <Button
                variant="destructive"
                className="flex-row items-center gap-2"
                onPress={() => setBulkDeleteOpen(true)}
                disabled={selectedCount === 0 || isBulkDeleting}>
                <Icon as={Trash2} size={16} className="text-destructive-foreground" />
                <Text className="text-sm text-destructive-foreground">
                  Delete ({selectedCount})
                </Text>
              </Button>
            </>
          )}
        </View>
      </View>

      {/* Sessions List */}
      <ScrollView className="flex-1 px-4">
        {filteredSessions.length === 0 ? (
          <View className="items-center py-8">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Icon as={MessageSquare} size={32} className="text-muted-foreground" />
            </View>
            <Text className="text-center text-sm text-muted-foreground">
              {searchTerm.trim().length > 0
                ? 'No sessions match your search.'
                : 'No sessions yet. Create one to start chatting about this property.'}
            </Text>
          </View>
        ) : (
          <View className="gap-4 pb-4">
            {/* Regular Sessions - Draft sessions are hidden */}
            {filteredSessions.map((session) => {
              const isSelected = selectedSessionIds.includes(session.id);
              const handleRowPress = () => {
                if (isSelectionMode) {
                  toggleSessionSelection(session.id);
                  return;
                }
                onSessionPress?.(session);
              };
              const handleRowLongPress = () => {
                if (!isSelectionMode) {
                  setIsSelectionMode(true);
                  setSelectedSessionIds([session.id]);
                }
              };

              return (
                <Pressable
                  key={session.id}
                  onPress={handleRowPress}
                  onLongPress={handleRowLongPress}
                  className={cn(
                    'rounded-lg border bg-card p-4',
                    isSelected ? 'border-primary' : 'border-border'
                  )}>
                  <View className="flex-row items-start gap-3">
                    {isSelectionMode && (
                      <View pointerEvents="none" className="mt-1">
                        <Checkbox checked={isSelected} onCheckedChange={() => {}} />
                      </View>
                    )}
                    <View className="flex-row flex-1 items-start gap-3">
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
                    </View>

                    {!isSelectionMode && (
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
                          <DropdownMenuItem onPress={() => handleOpenRenameDialog(session)}>
                            <Icon as={Pencil} size={20} className="text-foreground" />
                            <Text>Rename</Text>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onPress={() => setSessionToDelete(session)}>
                            <Icon as={Trash2} size={20} />
                            <Text>Delete</Text>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </View>
                </Pressable>
              );
            })}
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

      {/* Bulk Delete Dialog */}
      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open && !isBulkDeleting) {
            setBulkDeleteOpen(false);
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} session{selectedCount === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected chat session{selectedCount === 1 ? '' : 's'} and all associated
              messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>
              <Text className="text-sm">Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={handleBulkDeleteSessions}
              disabled={selectedCount === 0 || isBulkDeleting}
              className="bg-destructive">
              {isBulkDeleting && (
                <Icon as={Loader2} size={16} className="mr-2 text-destructive-foreground" />
              )}
              <Text className="text-sm text-destructive-foreground">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={(open) => !open && handleRenameDialogClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Chat Session</DialogTitle>
            <DialogDescription>
              Update the session name to better reflect the topic of your conversation.
            </DialogDescription>
          </DialogHeader>

          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Session name</Text>
            <Input
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Enter a new session name"
              autoFocus
              editable={!isRenaming}
            />
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={handleRenameDialogClose} disabled={isRenaming}>
              <Text className="text-sm">Cancel</Text>
            </Button>
            <Button onPress={handleSubmitRename} disabled={isRenameDisabled} className="flex-row items-center gap-2">
              {isRenaming && <Icon as={Loader2} size={16} className="text-primary-foreground" />}
              <Text className="text-sm text-primary-foreground">Save</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
