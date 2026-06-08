
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, MessageSquare, Trash2, ChevronLeft, X, Share2, Copy, Loader2, MoreHorizontal, Pencil, CheckSquare2, Square } from 'lucide-react';
import type { Session } from '@/lib/types';
import {
  SHARED_CHAT_TTL_DAYS,
  sharedChatExpiresAtFromNow,
  deleteAllInCollection,
  writeSharedChatMessages,
} from '@/lib/shared-chat';
import {
  deleteChatSession,
  deleteChatSessionsBatch,
  sessionDeleteConfirm,
  sessionDeleteFailed,
  sessionDeleteSuccess,
  sessionsBulkDeleteSuccess,
  resourceDeletingLabel,
  resourceDeletionFailedLabel,
  isResourceDeletionFailed,
} from '@homeapp/common/lib/deletion';
import { useOptimisticDeletionOverlay } from '@homeapp/common/hooks/use-optimistic-deletion-overlay';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useSession } from '@/contexts/session-context';
import { db, storage } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, where, updateDoc, getDocs, addDoc, serverTimestamp, getDoc, limit } from 'firebase/firestore';
import { getWebDeletionApiUrls } from '@/lib/api-deletion';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import { createLogger } from '@/lib/logger';
import {
  getSessionActivitySortTime,
  getSessionMessageCountLabel,
  getSessionSidebarActivityLabel,
} from '@/lib/session-timestamps';

const sessionLog = createLogger('session');

type ShareState = 'idle' | 'checking' | 'prompt_update' | 'creating' | 'updating' | 'done';

type SessionNavBarProps = {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    isMobileOpen: boolean;
    onMobileClose: () => void;
}

export function SessionNavBar({ isCollapsed, onToggleCollapse, isMobileOpen, onMobileClose }: SessionNavBarProps) {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { beginNewPropertyChatSession } = useSession();
  const [isStartingNewSession, setIsStartingNewSession] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [sessionDeleteDialogName, setSessionDeleteDialogName] = useState('');
  const { markDeleting, clearDeleting, isDeletingOverlay } = useOptimisticDeletionOverlay();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [sessionToShare, setSessionToShare] = useState<Session | null>(null);
  const [shareState, setShareState] = useState<ShareState>('idle');
  const [sharedLink, setSharedLink] = useState<string | null>(null);
  const [existingShareId, setExistingShareId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [sessionBeingRenamed, setSessionBeingRenamed] = useState<Session | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const sessionId = params.sessionId as string;
  const propertyId = params.propertyId as string;
  const selectedCount = selectedSessionIds.length;

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedSessionIds([]);
  }, []);

  useEffect(() => {
    setSearchTerm('');
    exitSelectionMode();
    setIsRenameDialogOpen(false);
    setSessionBeingRenamed(null);
    setRenameValue('');
    setIsRenaming(false);
  }, [propertyId, isMobileOpen, exitSelectionMode]);

  const handleNewChat = useCallback(async () => {
    if (!propertyId || !user || isStartingNewSession) return;

    setIsStartingNewSession(true);
    try {
      sessionLog.debug('new_session.click', {
        propertyId,
        currentSessionId: sessionId,
      });
      const targetSessionId = await beginNewPropertyChatSession(
        user.uid,
        propertyId,
        sessionId
      );
      if (!targetSessionId) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not start a new chat session. Please try again.',
        });
        return;
      }
      router.replace(`/home/properties/${propertyId}/chat/${targetSessionId}`);
      if (isMobileOpen) onMobileClose();
    } finally {
      setIsStartingNewSession(false);
    }
  }, [
    propertyId,
    user,
    sessionId,
    isStartingNewSession,
    beginNewPropertyChatSession,
    router,
    isMobileOpen,
    onMobileClose,
    toast,
  ]);

  useEffect(() => {
    if (!user || !propertyId) {
      setIsInitialLoading(false);
      setSessions([]);
      return;
    }
    
    setIsInitialLoading(true);
    const chatsRef = collection(db, 'users', user.uid, 'chats');
    
    const chatsQuery = query(
        chatsRef,
        where('propertyId', '==', propertyId),
        where('name', '!=', 'draft'),
        orderBy('name', 'asc'), 
        orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
        const userSessions = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Session))
            .sort((a, b) => getSessionActivitySortTime(b) - getSessionActivitySortTime(a));
        setSessions(userSessions);
        setIsInitialLoading(false);
    }, (error) => {
        sessionLog.error('sessions.snapshot.failed', undefined, error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update chat sessions in real-time.' });
        setIsInitialLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast, propertyId]);

  useEffect(() => {
    setSelectedSessionIds((previous) =>
      previous.filter((id) => sessions.some((session) => session.id === id))
    );
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    if (!normalizedTerm) {
      return sessions;
    }
    return sessions.filter((session) =>
      session.name?.toLowerCase().includes(normalizedTerm)
    );
  }, [sessions, searchTerm]);

  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedSessionIds.includes(session.id)),
    [sessions, selectedSessionIds]
  );

  const toggleSessionSelection = useCallback((sessionIdentifier: string) => {
    setSelectedSessionIds((previous) =>
      previous.includes(sessionIdentifier)
        ? previous.filter((id) => id !== sessionIdentifier)
        : [...previous, sessionIdentifier]
    );
  }, []);

  const isAllSelected =
    filteredSessions.length > 0 && selectedSessionIds.length === filteredSessions.length;

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

  const handleBulkDelete = useCallback(
    async (sessionIds: string[]) => {
      if (!user || sessionIds.length === 0) return;

      const deletionUrls = getWebDeletionApiUrls();
      try {
        const result = await deleteChatSessionsBatch({
          userId: user.uid,
          sessionIds,
          sessionsBatchUrl: deletionUrls.sessionsBatch,
          getIdToken: getFirebaseIdTokenForProxy,
        });
        if (!result.ok) {
          throw new Error(result.failed[0]?.message ?? 'Bulk delete failed');
        }

        if (sessionIds.includes(sessionId)) {
          router.replace(`/home/properties/${propertyId}/chat`);
        }

        toast({
          title: 'Sessions deleted',
          description: sessionsBulkDeleteSuccess(sessionIds.length),
        });
      } catch (error) {
        sessionLog.error('sessions.bulkDelete.failed', undefined, error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not delete the selected chat sessions.',
        });
      } finally {
        clearDeleting(sessionIds);
      }
    },
    [user, sessionId, router, propertyId, toast, clearDeleting]
  );

  const handleConfirmBulkDelete = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const sessionIds = selectedSessions.map((s) => s.id);
      if (sessionIds.length === 0) return;
      setIsBulkDeleteDialogOpen(false);
      exitSelectionMode();
      markDeleting(sessionIds);
      void handleBulkDelete(sessionIds);
    },
    [selectedSessions, exitSelectionMode, markDeleting, handleBulkDelete]
  );

  const handleRenameSession = useCallback((session: Session) => {
    if (isSelectionMode) {
      exitSelectionMode();
    }
    setSessionBeingRenamed(session);
    setRenameValue(session.name ?? '');
    setIsRenameDialogOpen(true);
  }, [exitSelectionMode, isSelectionMode]);

  const submitRename = useCallback(async () => {
    if (!user || !sessionBeingRenamed) return;
    const trimmedName = renameValue.trim();
    if (!trimmedName || trimmedName === sessionBeingRenamed.name) {
      setIsRenameDialogOpen(false);
      setSessionBeingRenamed(null);
      setRenameValue('');
      return;
    }

    setIsRenaming(true);
    try {
      const sessionRef = doc(db, 'users', user.uid, 'chats', sessionBeingRenamed.id);
      await updateDoc(sessionRef, { name: trimmedName, updatedAt: serverTimestamp() });
      toast({ title: 'Session updated', description: 'Chat session name has been updated.' });
      setIsRenameDialogOpen(false);
      setSessionBeingRenamed(null);
      setRenameValue('');
    } catch (error) {
      sessionLog.error('session.rename.failed', undefined, error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update the chat session name.',
      });
    } finally {
      setIsRenaming(false);
    }
  }, [db, renameValue, sessionBeingRenamed, toast, user]);

  const handleRenameDialogClose = useCallback(() => {
    if (isRenaming) return;
    setIsRenameDialogOpen(false);
    setSessionBeingRenamed(null);
    setRenameValue('');
  }, [isRenaming]);


  const handleOpenDeleteSessionDialog = useCallback((session: Session) => {
    setSessionToDelete(session);
    setSessionDeleteDialogName(session.name || '');
  }, []);

  const runDeleteSession = useCallback(
    async (session: Session) => {
      if (!user) return;
      const deletionUrls = getWebDeletionApiUrls();

      try {
        const result = await deleteChatSession({
          userId: user.uid,
          session,
          sessionDeleteUrl: deletionUrls.session,
          getIdToken: getFirebaseIdTokenForProxy,
        });
        if (!result.ok) {
          throw new Error(result.failed[0]?.message ?? 'Delete failed');
        }

        if (sessionId === session.id) {
          router.replace(`/home/properties/${propertyId}/chat`);
        }
        toast({ title: 'Session deleted', description: sessionDeleteSuccess });
      } catch (error) {
        sessionLog.error('session.delete.failed', undefined, error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: sessionDeleteFailed,
        });
      } finally {
        clearDeleting([session.id]);
      }
    },
    [user, sessionId, router, propertyId, toast, clearDeleting]
  );

  const handleConfirmSingleDelete = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const session = sessionToDelete;
      if (!session) return;
      setSessionToDelete(null);
      setSessionDeleteDialogName('');
      markDeleting([session.id]);
      void runDeleteSession(session);
    },
    [sessionToDelete, markDeleting, runDeleteSession]
  );

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
    }, 300); // Delay reset to allow for closing animation
  }

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
              setSharedLink(`${window.location.origin}/share/${existingDoc.id}`);
              setShareState('prompt_update');
          } else {
              // No existing share found, proceed to create
              await performShareAction(false); 
          }
      } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not check for existing share link.' });
          setShareState('idle');
      }
  };
  
  const performShareAction = async (isUpdating: boolean) => {
      if (!user || !sessionToShare) return;
      
      setShareState(isUpdating ? 'updating' : 'creating');
      
      try {
          // 1. Fetch original session and messages
          const sessionRef = doc(db, 'users', user.uid, 'chats', sessionToShare.id);
          const sessionSnap = await getDoc(sessionRef);
          if (!sessionSnap.exists()) throw new Error("Original session not found.");
          
          const messagesRef = collection(sessionRef, 'messages');
          const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));
          const messagesSnap = await getDocs(messagesQuery);
          
          const messages = messagesSnap.docs.map((messageDoc) => messageDoc.data() as Record<string, unknown>);

          let shareId: string;
          
          if (isUpdating && existingShareId) {
              shareId = existingShareId;
              const sharedChatRef = doc(db, 'sharedChats', shareId);
              const sharedMessagesRef = collection(sharedChatRef, 'messages');
              
              await deleteAllInCollection(db, sharedMessagesRef);
              await writeSharedChatMessages(db, sharedMessagesRef, messages);

              await updateDoc(sharedChatRef, {
                updatedAt: serverTimestamp(),
                expiresAt: sharedChatExpiresAtFromNow(),
              });

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
                  expiresAt: sharedChatExpiresAtFromNow(),
              });
              shareId = newSharedChatRef.id;
              
              const sharedMessagesRef = collection(newSharedChatRef, 'messages');
              await writeSharedChatMessages(db, sharedMessagesRef, messages);
          }

          setSharedLink(`${window.location.origin}/share/${shareId}`);
          setShareState('done');

      } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
          toast({ variant: 'destructive', title: 'Error Sharing', description: `Could not share the session. ${errorMessage}` });
          setShareState('idle');
      }
  };


  return (
    <>
      <header
        className={cn(
          "flex items-center border-b shrink-0",
          isCollapsed ? "justify-center px-2 py-2" : "justify-between p-4"
        )}
      >
        <h2 className={cn('text-lg font-semibold', isCollapsed && "sr-only")}>Chat Sessions</h2>
        <div className={cn("flex items-center gap-2", isCollapsed && "w-full justify-center")}>
          <Button
            className={cn("flex-shrink-0 h-8 w-8 rounded-lg p-0", isCollapsed && "hidden")}
            onClick={() => void handleNewChat()}
            disabled={isInitialLoading || isSelectionMode || isStartingNewSession}
            aria-label="New Session"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="flex-shrink-0 h-8 w-8 rounded-lg p-0 hidden lg:flex items-center justify-center"
            onClick={onToggleCollapse}
            aria-label="Toggle sidebar"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")} />
          </Button>
          <Button
            variant="ghost"
            className="flex-shrink-0 h-8 w-8 rounded-lg p-0 lg:hidden"
            onClick={onMobileClose}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>
      {!isCollapsed && (
        <div className="px-4 py-3 border-b space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search sessions"
              className="h-9 flex-1 min-w-0"
              aria-label="Search chat sessions by issue name"
            />
            {!isSelectionMode ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 h-9 w-9 rounded-lg p-0"
                    onClick={handleToggleSelectionMode}
                    disabled={isInitialLoading || filteredSessions.length === 0}
                    aria-pressed={isSelectionMode}
                    aria-label="Select sessions"
                  >
                    <CheckSquare2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select sessions</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0 h-9 w-9 rounded-lg p-0"
                      onClick={handleSelectAll}
                      aria-label={isAllSelected ? "Clear all selections" : "Select all sessions"}
                    >
                      {isAllSelected ? (
                        <Square className="h-4 w-4" />
                      ) : (
                        <CheckSquare2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isAllSelected ? "Clear all" : "Select all"}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-shrink-0 h-9 w-9 rounded-lg p-0"
                      onClick={() => setIsBulkDeleteDialogOpen(true)}
                      disabled={selectedCount === 0}
                      aria-label={`Delete ${selectedCount} session${selectedCount !== 1 ? 's' : ''}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete {selectedCount} session{selectedCount !== 1 ? 's' : ''}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 h-9 w-9 rounded-lg p-0"
                      onClick={handleToggleSelectionMode}
                      aria-label="Cancel selection"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cancel</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
          {isSelectionMode && selectedCount > 0 && (
            <div className="text-xs text-muted-foreground font-medium">
              {selectedCount} session{selectedCount !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      )}
        <ScrollArea className="flex-1 w-full whitespace-nowrap session-sidebar-scroll">
            <TooltipProvider>
                <div className="flex flex-col w-full space-y-2 p-2">
                {isInitialLoading ? (
                    <div className='space-y-2'>
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className={cn("h-16 w-full", isCollapsed && "h-10")} />
                        ))}
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-6 text-center text-sm text-muted-foreground whitespace-normal">
                      {searchTerm.trim().length > 0
                        ? 'No sessions match your search.'
                        : 'No sessions yet. Start a new chat to get started.'}
                    </div>
                ) : (
                    filteredSessions.map((session) => {
                    const route = `/home/properties/${propertyId}/chat/${session.id}`;
                    const isActive = sessionId === session.id;
                    const activityLabel = getSessionSidebarActivityLabel(session);
                    const messageCountLabel = getSessionMessageCountLabel(session);

                    if (isCollapsed) {
                        const isSelected = selectedSessionIds.includes(session.id);
                        const isDeleting = isDeletingOverlay(session);
                        const isDeleteFailed = isResourceDeletionFailed(session);
                        const handleItemInteraction = () => {
                            if (isDeleting) return;
                            if (isSelectionMode) {
                                toggleSessionSelection(session.id);
                                return;
                            }
                            router.push(route);
                            if(isMobileOpen) onMobileClose();
                        };
                        const handleItemKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                handleItemInteraction();
                            }
                        };

                        return (
                             <Tooltip key={session.id} delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={handleItemInteraction}
                                        onKeyDown={handleItemKeyDown}
                                        className={cn(
                                            "group relative flex items-center justify-center w-full p-3 rounded-lg cursor-pointer transition-colors h-10",
                                            isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50",
                                            isSelectionMode && "pl-8",
                                            isSelected && "ring-2 ring-primary",
                                            isDeleting && "opacity-90"
                                        )}
                                    >
                                        {isDeleting && (
                                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/90">
                                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                            </div>
                                        )}
                                        {isSelectionMode && (
                                            <div
                                                className="absolute left-2 top-1/2 -translate-y-1/2"
                                                onClick={(event) => event.stopPropagation()}
                                                onKeyDown={(event) => event.stopPropagation()}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleSessionSelection(session.id)}
                                                    aria-label={isSelected ? "Deselect session" : "Select session"}
                                                />
                                            </div>
                                        )}
                                        <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0" />
                                        {!isSelectionMode && !isDeleting && (
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent side="right" align="start" onClick={e => e.stopPropagation()}>
                                                        <DropdownMenuItem onClick={() => handleOpenShareDialog(session)}>
                                                            <Share2 className="mr-2 h-4 w-4" /> Share
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleRenameSession(session)}>
                                                            <Pencil className="mr-2 h-4 w-4" /> Rename
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleOpenDeleteSessionDialog(session)} className="text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p className='font-medium'>{session.name}</p>
                                    {activityLabel && (
                                      <p className='text-xs text-muted-foreground'>{activityLabel}</p>
                                    )}
                                    {messageCountLabel && (
                                      <p className='text-xs text-muted-foreground'>{messageCountLabel}</p>
                                    )}
                                </TooltipContent>
                            </Tooltip>
                        )
                    }

                    const isSelected = selectedSessionIds.includes(session.id);
                    const isDeleting = isDeletingOverlay(session);
                    const isDeleteFailed = isResourceDeletionFailed(session);
                    const handleItemInteraction = () => {
                        if (isDeleting) return;
                        if (isSelectionMode) {
                            toggleSessionSelection(session.id);
                            return;
                        }
                        router.push(route);
                        if(isMobileOpen) onMobileClose();
                    };
                    const handleItemKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleItemInteraction();
                        }
                    };

                    return (
                        <div
                        key={session.id}
                        role="button"
                        tabIndex={0}
                        onClick={handleItemInteraction}
                        onKeyDown={handleItemKeyDown}
                        className={cn(
                            "group relative flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors w-full",
                            isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50",
                            isSelected && "ring-2 ring-primary",
                            isDeleting && "opacity-90"
                        )}
                        >
                        {isDeleting && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/90">
                                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {resourceDeletingLabel}
                                </div>
                            </div>
                        )}
                        <div className='flex-1 flex items-start gap-3 min-w-0'>
                            {isSelectionMode && (
                                <div
                                    className="mt-0.5 shrink-0"
                                    onClick={(event) => event.stopPropagation()}
                                    onKeyDown={(event) => event.stopPropagation()}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => toggleSessionSelection(session.id)}
                                        aria-label={isSelected ? "Deselect session" : "Select session"}
                                    />
                                </div>
                            )}
                            <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                            <div className='flex-1 flex flex-col gap-0.5 min-w-0 overflow-hidden'>
                                <p className="text-sm font-medium truncate text-foreground">{session.name}</p>
                                {activityLabel && (
                                  <p className="text-xs text-muted-foreground truncate">{activityLabel}</p>
                                )}
                                {messageCountLabel && (
                                  <p className="text-xs text-muted-foreground truncate">{messageCountLabel}</p>
                                )}
                                {isDeleteFailed ? (
                                  <p className="text-xs text-destructive truncate">{session.deletionError || resourceDeletionFailedLabel}</p>
                                ) : null}
                            </div>
                        </div>
                        {!isSelectionMode && !isDeleting && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={e => e.stopPropagation()}>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="right" align="end" onClick={e => e.stopPropagation()}>
                                    <DropdownMenuItem onClick={() => handleOpenShareDialog(session)}>
                                        <Share2 className="mr-2 h-4 w-4" /> Share
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleRenameSession(session)}>
                                        <Pencil className="mr-2 h-4 w-4" /> Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenDeleteSessionDialog(session)} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        </div>
                    )
                    })
                )}
                </div>
            </TooltipProvider>
        </ScrollArea>
        <footer className={cn('h-[84px] flex items-center p-2 border-t shrink-0', isCollapsed && "justify-center")}>
            <Button variant="outline" className={cn('w-full', isCollapsed && "w-10 h-10 p-0")} onClick={() => void handleNewChat()} disabled={isInitialLoading || isSelectionMode || isStartingNewSession}>
                <Plus className='h-4 w-4' />
                <span className={cn(isCollapsed && "sr-only", "ml-2")}>New Session</span>
            </Button>
        </footer>

      <AlertDialog
        open={!!sessionToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setSessionToDelete(null);
            setSessionDeleteDialogName('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {sessionDeleteConfirm(sessionDeleteDialogName)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSingleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} session{selectedCount === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected chat session{selectedCount === 1 ? '' : 's'} and all related
              messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkDelete}
              disabled={selectedCount === 0}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isRenameDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleRenameDialogClose();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Chat Session</DialogTitle>
            <DialogDescription>Update the session name to keep your chats organized.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="session-rename">Session name</Label>
              <Input
                id="session-rename"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder="Enter a new session name"
                disabled={isRenaming}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleRenameDialogClose} disabled={isRenaming}>
              Cancel
            </Button>
            <Button
              onClick={submitRename}
              disabled={
                isRenaming ||
                !renameValue.trim() ||
                renameValue.trim() === sessionBeingRenamed?.name
              }
            >
              {isRenaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sessionToShare} onOpenChange={(open) => !open && handleCloseShareDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Chat Session</DialogTitle>
             <DialogDescription>
                {shareState === 'done' ? `Anyone with this link can view a read-only version of this chat. Links expire after ${SHARED_CHAT_TTL_DAYS} days (extended when you update the share).` :
                 (shareState === 'prompt_update' ? 'A shared link already exists for this chat. You can update it with the latest messages.' : 
                 `Create a public, read-only link for "${sessionToShare?.name}"?`)}
            </DialogDescription>
          </DialogHeader>
            <div className="min-h-[60px] flex flex-col justify-center">
            {shareState === 'done' ? (
                <div className="flex items-center gap-2 pt-2">
                    <Input readOnly value={sharedLink!} className="h-9 bg-muted" />
                    <Button
                    size="sm"
                    onClick={() => {
                        navigator.clipboard.writeText(sharedLink!);
                        toast({ title: "Link Copied!" });
                    }}
                    >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                    </Button>
                </div>
            ) : shareState === 'prompt_update' || shareState === 'creating' || shareState === 'updating' ? (
                <div className="flex justify-end gap-2 pt-2">
                     <Button
                        variant="outline"
                        onClick={() => performShareAction(false)}
                        disabled={shareState === 'creating' || shareState === 'updating'}
                    >
                        {shareState === 'creating' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create New Link
                    </Button>
                    <Button onClick={() => performShareAction(true)} disabled={shareState === 'creating' || shareState === 'updating'}>
                        {shareState === 'updating' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Existing Link
                    </Button>
                </div>
            ) : (
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={handleCloseShareDialog}>Cancel</Button>
                    <Button onClick={checkForExistingShare} disabled={shareState !== 'idle'}>
                        {shareState === 'checking' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create public link
                    </Button>
                </div>
            )}
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

    
