"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type {
  Message,
  AgentStep,
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  SearchLocationInput,
  PrimaryAgent,
} from "@/lib/types";
import { ANALYSIS_OPTIONAL_AGENTS } from "@/lib/types";
import { ChatList } from "@/components/chat/chat-list";
import { CheckpointAnalysisProgressFooter } from "@/components/chat/checkpoint-analysis-progress-footer";
import { getInFlightCheckpointProgressFromMessages } from "@/lib/checkpoint-branch-progress";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { usePreferences } from "@/contexts/preferences-context";
import { ONBOARDING_CHAT_OPEN_PARAM } from "@/lib/home-onboarding";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { ChatPageSkeleton } from "@/components/chat/chat-page-skeleton";
import { useProperty } from "@/contexts/property-context";
import { defaultSearchLocationInput } from "@/lib/search-location";
import { createLogger } from "@/lib/logger";
import { trackSuggestedPromptClick } from "@/lib/analytics";
import {
  PropertyChatComposer,
  type PropertyChatComposerHandle,
} from "@/components/chat/property-chat-with-context";
import { sortMessagesChronologically } from "@/lib/sort-messages";

const chatLog = createLogger("chat");

export default function PropertyChatSessionPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const composerRef = useRef<PropertyChatComposerHandle>(null);

  const { user, authPending } = useRequireAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { updatePreferences } = usePreferences();
  const propertyId = params.propertyId as string;
  const sessionId = params.sessionId as string;
  const fromOnboardingChecklist =
    searchParams.get(ONBOARDING_CHAT_OPEN_PARAM) === "1";
  const onboardingHandledRef = useRef(false);

  const { isLoading: isDocsLoading, property } = useProperty();

  const [isNewSession, setIsNewSession] = useState(false);
  const [primaryAgent, setPrimaryAgent] = useState<PrimaryAgent>("checkpoint");
  const [selectedOptionalAgents, setSelectedOptionalAgents] = useState<
    AnalysisOptionalAgent[]
  >(() => [...ANALYSIS_OPTIONAL_AGENTS]);
  const [selectedCheckpointOptionalAgents, setSelectedCheckpointOptionalAgents] =
    useState<CheckpointOptionalAgent[]>([]);
  const [searchLocation, setSearchLocation] = useState<
    SearchLocationInput | undefined
  >(undefined);

  useEffect(() => {
    if (
      !fromOnboardingChecklist ||
      !propertyId ||
      !sessionId ||
      onboardingHandledRef.current
    ) {
      return;
    }
    onboardingHandledRef.current = true;
    // Strip the query param immediately so Timeline/Details clicks are
    // not overridden by a delayed router.replace after the Firestore write.
    router.replace(`/home/properties/${propertyId}/chat/${sessionId}`);
    void updatePreferences({ onboardingChatOpened: true });
  }, [fromOnboardingChecklist, propertyId, sessionId, updatePreferences, router]);

  useEffect(() => {
    if (!user || !sessionId) {
      setIsMessagesLoading(false);
      return;
    }

    const checkIsNewSession = async () => {
      const sessionDocRef = doc(db, "users", user.uid, "chats", sessionId);
      const sessionDoc = await getDoc(sessionDocRef);
      setIsNewSession(sessionDoc.exists() && sessionDoc.data().name === "draft");
    };
    void checkIsNewSession();

    setIsMessagesLoading(true);
    const messagesQuery = query(
      collection(db, "users", user.uid, "chats", sessionId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const fetchedMessages = sortMessagesChronologically(
          snapshot.docs.map(
            (docSnap) =>
              ({
                id: docSnap.id,
                ...docSnap.data(),
                createdAt: (docSnap.data().createdAt as Timestamp)?.toDate(),
              }) as Message
          )
        );
        setMessages(fetchedMessages);
        setIsMessagesLoading(false);
      },
      (error) => {
        chatLog.error("messages.subscribe.failed", { sessionId }, error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load chat history.",
        });
        setIsMessagesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, sessionId, toast]);

  useEffect(() => {
    if (sessionId && !searchLocation) {
      setSearchLocation(defaultSearchLocationInput());
    }
  }, [sessionId, searchLocation]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const branchProgress = useMemo(() => {
    return getInFlightCheckpointProgressFromMessages(messages, {
      isStreamActive: isLoading,
    });
  }, [messages, isLoading]);

  const handleSuggestedPrompt = (prompt: string) => {
    trackSuggestedPromptClick(prompt);
    composerRef.current?.send(prompt);
  };

  const handleSuggestedAction = (
    action: import("@/lib/types").SuggestedAction
  ) => {
    composerRef.current?.send(action.userQuery, {
      chatIntent: action.chatIntent,
    });
  };

  if (authPending || !user || isMessagesLoading || isDocsLoading) {
    return <ChatPageSkeleton />;
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <main className="flex-1 overflow-hidden">
        <ChatList
          messages={messages}
          isMessagesLoading={isMessagesLoading && messages.length === 0}
          isStreamActive={isLoading}
          context="property"
          primaryAgent={primaryAgent}
          onSelectSuggestedPrompt={handleSuggestedPrompt}
          onSuggestedAction={handleSuggestedAction}
          isSendDisabled={isLoading}
        />
      </main>
      <div className="shrink-0">
        {branchProgress ? (
          <CheckpointAnalysisProgressFooter progress={branchProgress} />
        ) : null}
        <PropertyChatComposer
          ref={composerRef}
          sessionId={sessionId}
          propertyId={propertyId}
          propertyAddress={property?.address}
          primaryAgent={primaryAgent}
          onPrimaryAgentChange={setPrimaryAgent}
          selectedOptionalAgents={selectedOptionalAgents}
          onOptionalAgentsChange={setSelectedOptionalAgents}
          selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
          onCheckpointOptionalAgentsChange={setSelectedCheckpointOptionalAgents}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          isNewSession={isNewSession}
          setIsNewSession={setIsNewSession}
          searchLocation={searchLocation}
          onSearchLocationChange={setSearchLocation}
          abortControllerRef={abortControllerRef}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
