"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type {
  Message,
  FileAttachment,
  Property,
  Document as DocumentType,
  AgentStep,
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  LocationData,
  PrimaryAgent,
} from "@/lib/types";
import { ANALYSIS_OPTIONAL_AGENTS, CHECKPOINT_OPTIONAL_AGENTS } from "@/lib/types";
import { ChatList } from "@/components/chat/chat-list";
import { ChatInput } from "@/components/chat/chat-input";
import { useAuth } from "@/contexts/auth-context";
import { useRouter, useParams } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  collection,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  DocumentData,
  WithFieldValue,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { ChatPageSkeleton } from "@/components/chat/chat-page-skeleton";
import { useSession } from "@/contexts/session-context";
import { useProperty } from "@/contexts/property-context";
import { ChatContextHeader } from "@/components/chat/chat-context-header";
import { usePropertyDocuments } from "@/contexts/property-documents-context";
import { useCheckpoint } from "@/contexts/checkpoint-context";
import { CheckpointDrawer } from "@/components/checkpoints/checkpoint-drawer";
import type { Checkpoint } from "@/lib/types";
import { apiUrls } from "@/lib/utils";

export default function PropertyChatSessionPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const [fileAttachment, setFileAttachment] = useState<FileAttachment | null>(
    null
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const propertyId = params.propertyId as string;
  const sessionId = params.sessionId as string;

  const {
    documents: contextDocuments,
    isLoading: isDocsLoading,
    property,
  } = useProperty();
  const { selectedDocuments, handleDocumentSelect, clearSelectedDocuments } =
    usePropertyDocuments();

  const { checkpoints } = useCheckpoint();

  const [isNewSession, setIsNewSession] = useState(false);
  const [primaryAgent, setPrimaryAgent] = useState<PrimaryAgent>('checkpoint');
  const [selectedOptionalAgents, setSelectedOptionalAgents] = useState<
    AnalysisOptionalAgent[]
  >(() => [...ANALYSIS_OPTIONAL_AGENTS]);
  const [selectedCheckpointOptionalAgents, setSelectedCheckpointOptionalAgents] = useState<
    CheckpointOptionalAgent[]
  >([]);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<Checkpoint[]>([]);
  const [isCheckpointDrawerOpen, setIsCheckpointDrawerOpen] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | undefined>(
    undefined
  );

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Fetch messages for the session
  useEffect(() => {
    if (!user || !sessionId) {
      setIsMessagesLoading(false);
      return;
    }

    const checkIsNewSession = async () => {
      const sessionDocRef = doc(db, "users", user.uid, "chats", sessionId);
      const sessionDoc = await getDoc(sessionDocRef);
      if (sessionDoc.exists() && sessionDoc.data().name === "draft") {
        setIsNewSession(true);
      } else {
        setIsNewSession(false);
      }
    };
    checkIsNewSession();

    setIsMessagesLoading(true);
    const messagesQuery = query(
      collection(db, "users", user.uid, "chats", sessionId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const fetchedMessages = snapshot.docs.map(
          (docSnap) =>
            ({
              id: docSnap.id,
              ...docSnap.data(),
              createdAt: (docSnap.data().createdAt as Timestamp)?.toDate(),
            }) as Message
        );
        setMessages(fetchedMessages);
        setIsMessagesLoading(false);
      },
      (error) => {
        console.error("Error subscribing to messages:", error);
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

  // Auto-set current location when session is created
  useEffect(() => {
    const setDefaultLocation = async () => {
      // Only set location if:
      // 1. We have a session
      // 2. Location data is not already set
      // 3. It's a new session
      if (sessionId && !locationData && isNewSession) {
        try {
          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const defaultLocationData: LocationData = {
                  locationType: 'location',
                  locationCoordinates: {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                  },
                  locationRadius: 5, // Default 5 mile radius
                };
                setLocationData(defaultLocationData);
                console.log('[ChatPage] Auto-set current location:', defaultLocationData);
              },
              (error) => {
                console.log('[ChatPage] Location permission not granted or error:', error);
                // Silently fail - user can manually set location if needed
              }
            );
          } else {
            console.log('[ChatPage] Geolocation not supported by browser');
          }
        } catch (error) {
          console.error('[ChatPage] Error getting default location:', error);
          // Silently fail - user can manually set location if needed
        }
      }
    };

    setDefaultLocation();
  }, [sessionId, locationData, isNewSession]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const addMessageToFirestore = async (
    currentSessionId: string,
    message: WithFieldValue<DocumentData>
  ): Promise<string | null> => {
    if (!user) return null;
    try {
      const docRef = await addDoc(
        collection(
          db,
          "users",
          user.uid,
          "chats",
          currentSessionId,
          "messages"
        ),
        {
          ...message,
          createdAt: serverTimestamp(),
        }
      );
      return docRef.id;
    } catch (error) {
      console.error("Error adding message to Firestore:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not save your message.",
      });
      return null;
    }
  };

  const handleFileUpload = useCallback(
    (file: File) => {
      if (!user) return;

      const previewUrl = URL.createObjectURL(file);
      const attachmentId = `upload-${Date.now()}`;
      const storageRef = ref(
        storage,
        `uploads/${user.uid}/${Date.now()}_${file.name}`
      );

      setFileAttachment({
        id: attachmentId,
        file: file,
        previewUrl: previewUrl,
        progress: 0,
        downloadURL: null,
        error: null,
        storagePath: storageRef.fullPath,
      });

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setFileAttachment((prev) => (prev ? { ...prev, progress } : null));
        },
        (error) => {
          console.error("Upload error:", error);
          setFileAttachment((prev) =>
            prev ? { ...prev, error: "Upload failed. Please try again." } : null
          );
          URL.revokeObjectURL(previewUrl);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setFileAttachment((prev) =>
              prev ? { ...prev, progress: 100, downloadURL } : null
            );
          } catch (error) {
            console.error("Failed to get download URL:", error);
            setFileAttachment((prev) =>
              prev ? { ...prev, error: "Failed to process file." } : null
            );
          }
        }
      );
    },
    [user]
  );

  const removeFileAttachment = useCallback(async () => {
    if (!fileAttachment) return;

    if (fileAttachment.storagePath) {
      const fileRef = ref(storage, fileAttachment.storagePath);
      try {
        await deleteObject(fileRef);
      } catch (error: any) {
        if (error.code !== "storage/object-not-found") {
          console.error("Error deleting file from storage:", error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Could not remove the uploaded file.",
          });
        }
      }
    }

    if (fileAttachment.previewUrl) {
      URL.revokeObjectURL(fileAttachment.previewUrl);
    }
    setFileAttachment(null);
  }, [fileAttachment, toast]);

  const handleOptionalAgentsChange = useCallback(
    (agents: AnalysisOptionalAgent[]) => {
      setSelectedOptionalAgents(agents);
    },
    []
  );

  const handleCheckpointToggle = useCallback((checkpoint: Checkpoint) => {
    setSelectedCheckpoints((prev) => {
      const isSelected = prev.some((cp) => cp.id === checkpoint.id);
      if (isSelected) {
        return prev.filter((cp) => cp.id !== checkpoint.id);
      } else {
        return [...prev, checkpoint];
      }
    });
  }, []);

  const handleRemoveCheckpoint = useCallback((checkpoint: Checkpoint) => {
    setSelectedCheckpoints((prev) => prev.filter((cp) => cp.id !== checkpoint.id));
  }, []);

  // Auto-select all checkpoints when switching to checkpoint agent
  useEffect(() => {
    if (primaryAgent === 'checkpoint' && checkpoints && checkpoints.length > 0 && selectedCheckpoints.length === 0) {
      setSelectedCheckpoints(checkpoints);
    }
  }, [primaryAgent, checkpoints, selectedCheckpoints.length]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!user) return;

      if (fileAttachment && !fileAttachment.downloadURL) {
        toast({
          variant: "destructive",
          title: "Please wait",
          description: "File is still uploading.",
        });
        return;
      }
      if (isLoading) return;

      if (
        !content.trim() &&
        !fileAttachment &&
        selectedDocuments.length === 0
      ) {
        return;
      }

      setIsLoading(true);
      let activeSessionId = sessionId;

      // Claim draft session if it's a new one
      if (isNewSession) {
        const sessionRef = doc(db, "users", user.uid, "chats", activeSessionId);
        const newName = `session: ${new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}`;
        await updateDoc(sessionRef, {
          name: newName,
          propertyId: propertyId, // Explicitly link to property
        });
        setIsNewSession(false);
      }

      const userMessagePayload: WithFieldValue<DocumentData> = {
        role: "user",
        content,
      };

      if (fileAttachment && fileAttachment.downloadURL) {
        const snapshotRef = ref(storage, fileAttachment.storagePath);
        userMessagePayload.file = {
          name: fileAttachment.file.name,
          type: fileAttachment.file.type,
          url: fileAttachment.downloadURL,
          gsURI: `gs://${snapshotRef.bucket}/${snapshotRef.fullPath}`,
        };
      }

      addMessageToFirestore(activeSessionId, {
        ...userMessagePayload,
      });

      setFileAttachment(null);

      const assistantMessageDocId = await addMessageToFirestore(activeSessionId, {
        role: "assistant",
        content: "",
        primaryAgent,
      });

      try {
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        const sessionDoc = await getDoc(
          doc(db, "users", user.uid, "chats", activeSessionId)
        );
        const agentSessionId = sessionDoc.exists()
          ? sessionDoc.data().agentSessionId
          : undefined;

        const contextDocURIs = selectedDocuments
          .map((d) => d.gsURI)
          .filter((uri): uri is string => !!uri);
        const diagnosisURIs = userMessagePayload.file?.gsURI
          ? [userMessagePayload.file.gsURI]
          : [];

        const checkpointIds = selectedCheckpoints
          .map((cp) => cp.id)
          .filter((id): id is string => !!id);

        const normalizedPrimaryAgent =
          primaryAgent === "docs" || primaryAgent === "checkpoint"
            ? primaryAgent
            : undefined;

        const requestBody: Record<string, any> = {
          user_id: user.uid,
          session_id: agentSessionId,
          user_query: content,
          context_doc_uris: contextDocURIs,
          diagnosis_uris: diagnosisURIs,
          property_address: property?.address,
          property_id: property?.id, // Pass property_id for checkpoint queries
          primary_agent: normalizedPrimaryAgent,
          checkpoint_optional_agents: selectedCheckpointOptionalAgents.length > 0 ? selectedCheckpointOptionalAgents : undefined,
          checkpoint_ids: checkpointIds.length > 0 ? checkpointIds : undefined,
        };

        // Add location data if provided
        if (locationData) {
          if (locationData.locationType) {
            requestBody.location_type = locationData.locationType;
          }
          if (locationData.locationCoordinates) {
            requestBody.location_coordinates = locationData.locationCoordinates;
          }
          if (locationData.locationRadius !== undefined) {
            requestBody.location_radius = locationData.locationRadius;
          }
        }

        const response = await fetch(apiUrls.agentSse(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`API request failed: ${errorBody}`);
        }
        if (!response.body) throw new Error("The response body is empty.");

        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const rawChunk = new TextDecoder().decode(value, { stream: true });
          if (rawChunk.startsWith("STREAM_ERROR:")) {
            throw new Error(rawChunk.substring("STREAM_ERROR:".length));
          }
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "An unknown error occurred.";
          toast({
            variant: "destructive",
            title: "Error",
            description: `Failed to get a response from the AI. ${errorMessage}`,
          });
          if (assistantMessageDocId && user) {
            const assistantDocRef = doc(
              db,
              "users",
              user.uid,
              "chats",
              activeSessionId,
              "messages",
              assistantMessageDocId
            );
            updateDoc(assistantDocRef, {
              content: `Sorry, an error occurred: ${errorMessage}`,
            }).catch((updateError) =>
              console.error("Failed to update assistant error message:", updateError)
            );
          }
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      user,
      toast,
      fileAttachment,
      isLoading,
      sessionId,
      isNewSession,
      propertyId,
      property,
      selectedDocuments,
      primaryAgent,
      selectedOptionalAgents,
      selectedCheckpointOptionalAgents,
      selectedCheckpoints,
      locationData,
    ]
  );

  if (authLoading || isMessagesLoading || isDocsLoading) {
    return <ChatPageSkeleton />;
  }

  return (
    <div className="flex flex-1 flex-col h-full">
      <ChatContextHeader
        documents={selectedDocuments}
        onClear={clearSelectedDocuments}
        onRemove={handleDocumentSelect}
      />
      <main className="flex-1 overflow-hidden">
        <ChatList
          messages={messages}
          isMessagesLoading={isMessagesLoading && messages.length === 0}
          context={"property"}
        />
      </main>
      <div className="shrink-0">
        <footer className="flex items-center p-4 bg-card border-t">
          <ChatInput
            onSend={handleSend}
            isLoading={isLoading}
            onStop={handleStop}
            fileAttachment={fileAttachment}
            onFileChange={handleFileUpload}
            onFileRemove={removeFileAttachment}
            placeholder="Type a message or attach image/video to diagnose an issue..."
            primaryAgent={primaryAgent}
            onPrimaryAgentChange={setPrimaryAgent}
            selectedOptionalAgents={selectedOptionalAgents}
            onOptionalAgentsChange={handleOptionalAgentsChange}
            selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
            onCheckpointOptionalAgentsChange={setSelectedCheckpointOptionalAgents}
            selectedCheckpoints={selectedCheckpoints}
            onOpenCheckpointDrawer={() => setIsCheckpointDrawerOpen(true)}
            onRemoveCheckpoint={handleRemoveCheckpoint}
            locationData={locationData}
            onLocationDataChange={setLocationData}
            propertyAddress={property?.address}
          />
        </footer>
      </div>
      <CheckpointDrawer
        open={isCheckpointDrawerOpen}
        onOpenChange={setIsCheckpointDrawerOpen}
        checkpoints={checkpoints || []}
        selectedCheckpoints={selectedCheckpoints}
        onToggleCheckpoint={handleCheckpointToggle}
      />
    </div>
  );
}
