
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import type { Message, Session } from '@/lib/types';
import { isSharedChatExpired } from '@/lib/shared-chat';
import { ChatList } from '@/components/chat/chat-list';
import { ChatPageSkeleton } from '@/components/chat/chat-page-skeleton';
import { SavedServiceProvidersProvider } from '@/contexts/saved-service-providers-context';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, Share2 } from 'lucide-react';
import { AssetMemWordmark } from '@/components/brand/asset-mem-wordmark';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { createLogger } from '@/lib/logger';

const shareLog = createLogger('share');

function SharedChatHeader({ sessionName }: { sessionName: string | null }) {
    const { toast } = useToast();
    const router = useRouter();

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        toast({ title: "Link Copied!", description: "The link has been copied to your clipboard." });
    };

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b bg-background px-4">
            <div className="flex items-center gap-2 min-w-0">
                <div className="flex flex-col min-w-0">
                <AssetMemWordmark size="solutions" tone="app" className="truncate" />
                    {sessionName ? (
                        <h2 className="text-sm text-muted-foreground truncate" title={sessionName}>{sessionName}</h2>
                    ) : (
                        <Skeleton className="h-5 w-32 mt-1" />
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={handleCopyLink} className="p-2 sm:px-3">
                    <Share2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Share</span>
                </Button>
                <Button size="sm" onClick={() => router.push('/')} className="p-2 sm:px-3">
                    <span className="hidden sm:inline">Go to App</span>
                    <ExternalLink className="h-4 w-4 sm:ml-2" />
                </Button>
            </div>
        </header>
    );
}


export default function SharedChatPage() {
    const params = useParams();
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([]);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const shareId = params.shareId as string;

    useEffect(() => {
        if (!shareId) return;

        const fetchSharedChat = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const sessionRef = doc(db, 'sharedChats', shareId);
                const sessionSnap = await getDoc(sessionRef);

                if (!sessionSnap.exists()) {
                    throw new Error("This shared chat session does not exist or has been removed.");
                }

                const sessionData = sessionSnap.data();
                if (isSharedChatExpired(sessionData.expiresAt)) {
                    throw new Error("This shared link has expired. Ask the owner to create a new share from the app.");
                }

                setSession({ id: sessionSnap.id, ...sessionData } as Session);

                const messagesRef = collection(sessionRef, 'messages');
                const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));
                const messagesSnap = await getDocs(messagesQuery);

                const fetchedMessages = messagesSnap.docs.map(doc => {
                    const data = doc.data();
                    const createdAt = data.createdAt ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : (data.createdAt as Timestamp).toDate()) : new Date();
                    return {
                        id: doc.id,
                        ...data,
                        createdAt,
                    } as Message;
                });
                setMessages(fetchedMessages);

            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Could not load the shared chat.";
                shareLog.error('chat.fetch.failed', undefined, err);
                setError(message);
                toast({ variant: 'destructive', title: 'Error', description: message });
            } finally {
                setIsLoading(false);
            }
        };

        fetchSharedChat();
    }, [shareId, toast]);

    if (isLoading) {
        return (
            <div className="h-screen w-full flex flex-col">
                <SharedChatHeader sessionName={null} />
                <ChatPageSkeleton />
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center text-center p-4 bg-background">
                <SharedChatHeader sessionName={"Unavailable"} />
                <div className="flex-1 flex flex-col items-center justify-center">
                    <h2 className="text-xl font-semibold mb-2 text-destructive">Could not load chat</h2>
                    <p className="text-muted-foreground mb-6 max-w-sm">{error}</p>
                    <Button onClick={() => window.location.reload()}>Try Again</Button>
                </div>
            </div>
        )
    }

    return (
        <SavedServiceProvidersProvider propertyId={session?.propertyId ?? null}>
            <div className="h-screen w-full flex flex-col bg-muted/20">
                <SharedChatHeader sessionName={session?.name || 'Shared Chat'} />
                <main className="flex-1 overflow-hidden">
                    <ChatList messages={messages} isMessagesLoading={false} readOnly />
                </main>
                <footer className="p-3 text-center text-sm text-muted-foreground border-t bg-background">
                    Read-only shared chat. Do not share this link publicly if it contains sensitive property details.
                </footer>
            </div>
        </SavedServiceProvidersProvider>
    );
}
