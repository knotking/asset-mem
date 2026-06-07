
'use client';

import { useEffect, useRef, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/components/chat/chat-message';
import type { Message, SuggestedAction } from '@/lib/types';
import { assistantMessageHasDisplayableContent, getMessageDisplayParts } from '@/lib/message-display-parts';
import { countPriorAssistantTurnsInSession } from '@/lib/agent-lifecycle-ui';
import { getActiveStreamingAssistantMessageId } from '@/lib/sort-messages';
import { AnimatePresence } from 'framer-motion';
import { AssetMemBrandIcon } from '@/components/brand/asset-mem-brand-icon';
import { Button } from '@/components/ui/button';
import {
  CHAT_SESSION_EMPTY_INTRO,
  getSuggestedPrompts,
} from '@/lib/feature-discovery';
import { buildSuppressRepeatedContextRefsByMessageId } from '@/lib/chat-message-context-refs';
import { hasUserMessageBefore } from '@/lib/sort-messages';

type Props = {
  messages: Message[];
  isMessagesLoading: boolean;
  /** True while the composer stream/session is still open for the current turn. */
  isStreamActive?: boolean;
  context?: 'property' | null;
  /** Hide save-provider and other write actions (e.g. public shared chat). */
  readOnly?: boolean;
  onSelectSuggestedPrompt?: (prompt: string) => void;
  onSuggestedAction?: (action: SuggestedAction) => void;
  isSendDisabled?: boolean;
};

function assistantHasNoDisplayableContentYet(message: Message): boolean {
  if (message.role !== 'assistant') return false;
  return !assistantMessageHasDisplayableContent(getMessageDisplayParts(message));
}

export function ChatList({
  messages,
  isMessagesLoading,
  isStreamActive = false,
  context,
  readOnly = false,
  onSelectSuggestedPrompt,
  onSuggestedAction,
  isSendDisabled,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      // Use requestAnimationFrame to wait for the next paint, ensuring
      // the new message has been rendered and the scrollHeight is updated.
      requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight;
      });
    }
  }, [messages]);

  const suppressRepeatedContextRefsById = useMemo(
    () => buildSuppressRepeatedContextRefsByMessageId(messages),
    [messages]
  );

  const activeStreamingAssistantMessageId = useMemo(
    () => getActiveStreamingAssistantMessageId(messages, isStreamActive),
    [messages, isStreamActive]
  );

  const renderedMessages = useMemo(() => {
    return messages.map((message, index) => {
        const isPlaceholder = message.id.startsWith('local-');
        const isTurnInFlight =
          message.id === activeStreamingAssistantMessageId &&
          message.role === 'assistant' &&
          hasUserMessageBefore(messages, index);

        return (
            <ChatMessage 
                key={message.id} 
                message={message}
                isTurnInFlight={
                  isTurnInFlight ||
                  (isPlaceholder &&
                    assistantHasNoDisplayableContentYet(message) &&
                    isStreamActive)
                }
                context={context}
                readOnly={readOnly}
                priorAssistantTurnCount={countPriorAssistantTurnsInSession(messages, message.id)}
                hideRepeatedContextRefs={suppressRepeatedContextRefsById.get(message.id) ?? false}
                onSuggestedAction={onSuggestedAction}
                isSendDisabled={isSendDisabled}
            />
        )
    });
  }, [
    messages,
    context,
    readOnly,
    suppressRepeatedContextRefsById,
    onSuggestedAction,
    isSendDisabled,
    activeStreamingAssistantMessageId,
    isStreamActive,
  ]);

  const welcomeMessageVisible = messages.length === 1 && messages[0].id === 'intro-message';

  const isEmpty = messages.length === 0 && !isMessagesLoading;
  const suggestedPrompts = getSuggestedPrompts();

  return (
    <ScrollArea className="h-full w-full" viewportRef={viewportRef}>
      {isEmpty ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
          <div className="flex flex-col items-center text-center p-4 rounded-lg bg-card/80 max-w-md">
            <AssetMemBrandIcon size="lg" className="mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{CHAT_SESSION_EMPTY_INTRO.title}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              {CHAT_SESSION_EMPTY_INTRO.subtitle}
            </p>
            {onSelectSuggestedPrompt ? (
              <div className="flex w-full flex-col gap-2">
                {suggestedPrompts.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto whitespace-normal px-3 py-2 text-left text-sm"
                    disabled={isSendDisabled}
                    onClick={() => onSelectSuggestedPrompt(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <AnimatePresence initial={false}>
            {renderedMessages}
          </AnimatePresence>
          {welcomeMessageVisible && (
            <div className="text-center text-sm text-muted-foreground py-4">
              Welcome! Ask me anything about your property.
            </div>
          )}
        </div>
      )}
    </ScrollArea>
  );
}
