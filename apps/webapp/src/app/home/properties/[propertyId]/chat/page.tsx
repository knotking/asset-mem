
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from '@/contexts/session-context';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useToast } from '@/hooks/use-toast';
import { ChatPageSkeleton } from '@/components/chat/chat-page-skeleton';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

// This page acts as an entry point to find the existing draft chat session
// for the current property and then redirects to it.
export default function NewChatRedirectPage() {
    const { user, authPending } = useRequireAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const { draftsByProperty, createPropertyDraftSession } = useSession();
    const [creationError, setCreationError] = useState(false);

    const propertyId = params.propertyId as string;

    const tryCreateAndRedirect = async () => {
        if (!user || !propertyId) {
            if(!propertyId) router.replace('/home');
            return;
        };

        setCreationError(false);

        const propertyDraft = draftsByProperty[propertyId];

        if (propertyDraft) {
            router.replace(`/home/properties/${propertyId}/chat/${propertyDraft.id}`);
        } else {
            // The draft might not exist yet. Attempt to create it.
            const newSessionId = await createPropertyDraftSession(user.uid, propertyId);
            if (!newSessionId) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not create a new chat session. Please try again.' });
                setCreationError(true);
                // Do not redirect, stay here to show the error UI.
            }
            // If creation succeeds, the useEffect will re-run and redirect.
        }
    }

    useEffect(() => {
        if (authPending || !user) return;
        tryCreateAndRedirect();
    }, [user, propertyId, draftsByProperty, authPending]);

    if (authPending || !user) {
        return <ChatPageSkeleton />;
    }

    if (creationError) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
                <h2 className="text-xl font-semibold mb-2">Failed to Start Chat</h2>
                <p className="text-muted-foreground mb-6">We couldn't create a new chat session. Please check your connection and try again.</p>
                <Button onClick={tryCreateAndRedirect}>
                    Retry
                </Button>
            </div>
        );
    }

    return <ChatPageSkeleton />;
}
