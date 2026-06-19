'use client';

import { APP_SECTION_TITLE_CLASS } from '@/lib/app-typography';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ONBOARDING_CHAT_OPEN_PARAM } from '@/lib/home-onboarding';
import { useSession } from '@/contexts/session-context';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useToast } from '@/hooks/use-toast';
import { ChatPageSkeleton } from '@/components/chat/chat-page-skeleton';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { createLogger, truncateId } from '@/lib/logger';
import { cn } from '@/lib/utils';

const chatLog = createLogger('chat');

function buildChatRedirectQuery(
  searchParams: URLSearchParams,
  fromOnboardingChecklist: boolean,
): string {
  const params = new URLSearchParams();
  if (fromOnboardingChecklist) {
    params.set(ONBOARDING_CHAT_OPEN_PARAM, '1');
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

// Entry point: resolve the property draft (or create one) and redirect to it.
export default function NewChatRedirectPage() {
    const { user, authPending } = useRequireAuth();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const {
        draftsByProperty,
        beginNewPropertyChatSession,
        isLoading: isSessionsLoading,
    } = useSession();
    const [creationError, setCreationError] = useState(false);
    const redirectAttemptedRef = useRef(false);

    const propertyId = params.propertyId as string;
    const propertyDraftId = draftsByProperty[propertyId]?.id;
    const fromOnboardingChecklist =
      searchParams.get(ONBOARDING_CHAT_OPEN_PARAM) === '1';

    useEffect(() => {
        if (authPending || !user || !propertyId) {
            chatLog.debug('chat.redirect.wait', {
                reason: 'auth_or_property',
                authPending,
                hasUser: !!user,
                propertyId: truncateId(propertyId),
            });
            if (!propertyId && !authPending && user) {
                router.replace('/home');
            }
            return;
        }

        if (isSessionsLoading) {
            chatLog.debug('chat.redirect.wait', {
                reason: 'sessions_loading',
                propertyId: truncateId(propertyId),
            });
            return;
        }

        let cancelled = false;

        const tryCreateAndRedirect = async () => {
            if (!cancelled) {
                setCreationError(false);
            }

            if (propertyDraftId) {
                if (cancelled) return;
                chatLog.debug('chat.redirect.found', {
                    propertyId: truncateId(propertyId),
                    sessionId: truncateId(propertyDraftId),
                });
                const redirectQuery = buildChatRedirectQuery(searchParams, fromOnboardingChecklist);
                router.replace(
                  `/home/properties/${propertyId}/chat/${propertyDraftId}${redirectQuery}`
                );
                return;
            }

            if (redirectAttemptedRef.current) {
                chatLog.debug('chat.redirect.skip', {
                    propertyId: truncateId(propertyId),
                    reason: 'redirect_already_attempted',
                });
                return;
            }

            redirectAttemptedRef.current = true;
            chatLog.debug('chat.redirect.create', { propertyId: truncateId(propertyId) });

            const newSessionId = await beginNewPropertyChatSession(user.uid, propertyId);
            if (cancelled) return;

            if (!newSessionId) {
                redirectAttemptedRef.current = false;
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Could not create a new chat session. Please try again.',
                });
                setCreationError(true);
                return;
            }

            chatLog.debug('chat.redirect.created', {
                propertyId: truncateId(propertyId),
                sessionId: truncateId(newSessionId),
            });
            const redirectQuery = buildChatRedirectQuery(searchParams, fromOnboardingChecklist);
            router.replace(
              `/home/properties/${propertyId}/chat/${newSessionId}${redirectQuery}`
            );
        };

        void tryCreateAndRedirect();

        return () => {
            cancelled = true;
        };
    }, [
        user,
        propertyId,
        propertyDraftId,
        authPending,
        isSessionsLoading,
        fromOnboardingChecklist,
        router,
        toast,
        beginNewPropertyChatSession,
        searchParams,
    ]);

    const handleRetry = () => {
        redirectAttemptedRef.current = false;
        setCreationError(false);
        if (!user || !propertyId || isSessionsLoading) return;

        chatLog.debug('chat.redirect.retry', { propertyId: truncateId(propertyId) });
        void beginNewPropertyChatSession(user.uid, propertyId).then((newSessionId) => {
            if (!newSessionId) {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Could not create a new chat session. Please try again.',
                });
                setCreationError(true);
                return;
            }
            router.replace(`/home/properties/${propertyId}/chat/${newSessionId}`);
        });
    };

    if (authPending || !user) {
        return <ChatPageSkeleton />;
    }

    if (creationError) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
                <h2 className={cn(APP_SECTION_TITLE_CLASS, 'mb-2')}>Failed to Start Chat</h2>
                <p className="text-muted-foreground mb-6">We couldn&apos;t create a new chat session. Please check your connection and try again.</p>
                <Button onClick={handleRetry}>
                    Retry
                </Button>
            </div>
        );
    }

    return <ChatPageSkeleton />;
}
