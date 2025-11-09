
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
import { useToast } from '@/hooks/use-toast';
import { Plus, MessageSquare, Trash2, ChevronLeft, X, Share2, Copy, Loader2, MoreHorizontal } from 'lucide-react';
import type { Session, Message } from '@/lib/types';
import { deleteCollection, cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Input } from '../ui/input';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, where, updateDoc, getDocs, addDoc, serverTimestamp, getDoc, writeBatch, Timestamp, limit } from 'firebase/firestore';
import { deleteAgentSessionAction } from '@/app/actions';

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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [sessionToShare, setSessionToShare] = useState<Session | null>(null);
  const [shareState, setShareState] = useState<ShareState>('idle');
  const [sharedLink, setSharedLink] = useState<string | null>(null);
  const [existingShareId, setExistingShareId] = useState<string | null>(null);


  const sessionId = params.sessionId as string;
  const propertyId = params.propertyId as string;

  useEffect(() => {
    setSearchTerm('');
  }, [propertyId, isMobileOpen]);

  const handleNewChat = useCallback(() => {
    if (!propertyId) return;
    router.push(`/home/properties/${propertyId}/chat`);
    if(isMobileOpen) onMobileClose();
  }, [propertyId, router, isMobileOpen, onMobileClose]);

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
        const userSessions = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Session))
            .sort((a, b) => {
                const bTime = getTimestampValue(b.lastMessageAt ?? b.createdAt);
                const aTime = getTimestampValue(a.lastMessageAt ?? a.createdAt);
                return bTime - aTime;
            });
        setSessions(userSessions);
        setIsInitialLoading(false);
    }, (error) => {
        console.error("Error with session snapshot: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update chat sessions in real-time.' });
        setIsInitialLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast, propertyId]);

  const filteredSessions = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    if (!normalizedTerm) {
      return sessions;
    }
    return sessions.filter((session) =>
      session.name?.toLowerCase().includes(normalizedTerm)
    );
  }, [sessions, searchTerm]);


  const handleDeleteSession = async () => {
    if (!sessionToDelete || !user) return;
    
    const sessionToDeleteCache = sessionToDelete;
    setSessionToDelete(null);

    try {
        const sessionRef = doc(db, 'users', user.uid, 'chats', sessionToDeleteCache.id);
        const messagesColRef = collection(db, 'users', user.uid, 'chats', sessionToDeleteCache.id, 'messages');

        if (sessionToDeleteCache.agentSessionId) {
            deleteAgentSessionAction(user.uid, sessionToDeleteCache.agentSessionId).catch(error => {
                console.error("Failed to delete agent session from backend:", error);
            });
        }

        await deleteCollection(messagesColRef);
        await deleteDoc(sessionRef);

        if (sessionId === sessionToDeleteCache.id) {
            router.replace(`/home/properties/${propertyId}/chat`);
        }

    } catch (error) {
        console.error("Error deleting session:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not delete the chat session.',
        });
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
          
          const messages = messagesSnap.docs.map(doc => {
              const data = doc.data();
              return {
                  ...data,
                  createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
              } as unknown as Message;
          });

          let shareId: string;
          
          if (isUpdating && existingShareId) {
              shareId = existingShareId;
              const sharedChatRef = doc(db, 'sharedChats', shareId);
              const sharedMessagesRef = collection(sharedChatRef, 'messages');
              
              // Delete old messages
              await deleteCollection(sharedMessagesRef);

              // Add new messages
              const batch = writeBatch(db);
              messages.forEach(message => {
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
              messages.forEach(message => {
                  const messageRef = doc(sharedMessagesRef);
                  batch.set(messageRef, message);
              });
              await batch.commit();
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
      <header className={cn("flex items-center p-4 border-b shrink-0 h-[65px]", isCollapsed ? "justify-center px-2" : "justify-between")}>
          <h2 className={cn('text-lg font-semibold', isCollapsed && "sr-only")}>Chat Sessions</h2>
          <div className={cn("flex items-center gap-2", isCollapsed && "w-full justify-center")}>
            <Button
                className={cn("flex-shrink-0 h-8 w-8 rounded-lg p-0", isCollapsed && "hidden")}
                onClick={handleNewChat}
                disabled={isInitialLoading}
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
          <div className="px-4 py-3 border-b">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search sessions"
              className="h-9"
              aria-label="Search chat sessions by issue name"
            />
          </div>
        )}
        <ScrollArea className="flex-1 w-full whitespace-nowrap">
            <TooltipProvider>
                <div className="flex flex-col w-full space-y-2 p-2">
                {isInitialLoading ? (
                    <div className='space-y-2'>
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className={cn("h-16 w-full", isCollapsed && "h-10")} />
                        ))}
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-6 text-center text-sm text-muted-foreground">
                      {searchTerm.trim().length > 0
                        ? 'No sessions match your search.'
                        : 'No sessions yet. Start a new chat to get started.'}
                    </div>
                ) : (
                    filteredSessions.map((session) => {
                    const route = `/home/properties/${propertyId}/chat/${session.id}`;
                    const isActive = sessionId === session.id;
                    const sessionDate = session.createdAt?.toDate ? format(session.createdAt.toDate(), 'M/d/yyyy') : '...';
                    
                    const handleSessionClick = () => {
                        router.push(route);
                        if(isMobileOpen) onMobileClose();
                    }

                    if (isCollapsed) {
                        return (
                             <Tooltip key={session.id} delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={handleSessionClick}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSessionClick()}}
                                        className={cn(
                                            "group relative flex items-center justify-center w-full p-3 rounded-lg cursor-pointer transition-colors h-10",
                                            isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"
                                        )}
                                    >
                                        <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0" />
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
                                                    <DropdownMenuItem onClick={() => setSessionToDelete(session)} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p className='font-medium'>{session.name}</p>
                                    <p className='text-xs text-muted-foreground'>{sessionDate}</p>
                                </TooltipContent>
                            </Tooltip>
                        )
                    }

                    return (
                        <div
                        key={session.id}
                        role="button"
                        tabIndex={0}
                        onClick={handleSessionClick}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSessionClick()}}
                        className={cn(
                            "group flex items-center justify-between w-[90%] p-3 rounded-lg cursor-pointer transition-colors",
                            isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"
                        )}
                        >
                        <div className='flex-1 flex items-start gap-3 min-w-0'>
                            <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                            <div className='flex-1 flex flex-col gap-1 min-w-0'>
                                <p className="text-sm font-medium truncate text-foreground">{session.name}</p>
                                <p className="text-xs text-muted-foreground">{sessionDate}</p>
                            </div>
                        </div>
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
                                <DropdownMenuItem onClick={() => setSessionToDelete(session)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                    )
                    })
                )}
                </div>
            </TooltipProvider>
        </ScrollArea>
        <footer className={cn('h-[84px] flex items-center p-2 border-t shrink-0', isCollapsed && "justify-center")}>
            <Button variant="outline" className={cn('w-full', isCollapsed && "w-10 h-10 p-0")} onClick={handleNewChat} disabled={isInitialLoading}>
                <Plus className='h-4 w-4' />
                <span className={cn(isCollapsed && "sr-only", "ml-2")}>New Session</span>
            </Button>
        </footer>

      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the chat session &quot;{sessionToDelete?.name}&quot; and all of its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!sessionToShare} onOpenChange={(open) => !open && handleCloseShareDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Chat Session</DialogTitle>
             <DialogDescription>
                {shareState === 'done' ? 'Anyone with this link can view a read-only version of this chat.' :
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

    