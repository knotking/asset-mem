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
  LocationData,
} from "@/lib/types";
import { ANALYSIS_OPTIONAL_AGENTS } from "@/lib/types";
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
  setDoc,
  getDoc,
  where,
  getDocs,
  limit,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { ChatPageSkeleton } from "@/components/chat/chat-page-skeleton";
import { useSession } from "@/contexts/session-context";
import { useProperty } from "@/contexts/property-context";
import { ChatContextHeader } from "@/components/chat/chat-context-header";
import { usePropertyDocuments } from "@/contexts/property-documents-context";

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

  const [isNewSession, setIsNewSession] = useState(false);
  const [selectedOptionalAgents, setSelectedOptionalAgents] = useState<
    AnalysisOptionalAgent[]
  >(() => [...ANALYSIS_OPTIONAL_AGENTS]);
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

    const fetchInitialMessages = async () => {
      setIsMessagesLoading(true);
      try {
        const sessionDocRef = doc(db, "users", user.uid, "chats", sessionId);
        const sessionDoc = await getDoc(sessionDocRef);

        if (sessionDoc.exists() && sessionDoc.data().name === "draft") {
          setIsNewSession(true);
          setMessages([]);
        } else {
          setIsNewSession(false);
          const messagesQuery = query(
            collection(db, "users", user.uid, "chats", sessionId, "messages"),
            orderBy("createdAt", "asc")
          );
          const querySnapshot = await getDocs(messagesQuery);
          const fetchedMessages = querySnapshot.docs.map(
            (doc) =>
              ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as Timestamp)?.toDate(),
              }) as Message
          );
          setMessages(fetchedMessages);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load chat history.",
        });
      } finally {
        setIsMessagesLoading(false);
      }
    };

    fetchInitialMessages();

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
  }, [user, sessionId, toast]);

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
        const newName =
          content.substring(0, 30) || fileAttachment?.file.name || "New Chat";
        await updateDoc(sessionRef, {
          name: newName,
          propertyId: propertyId, // Explicitly link to property
        });
        setIsNewSession(false);
      }

      const userMessage: Message = {
        id: `local-user-${Date.now()}`,
        role: "user",
        content,
      };

      if (fileAttachment && fileAttachment.downloadURL) {
        const snapshotRef = ref(storage, fileAttachment.storagePath);
        userMessage.file = {
          name: fileAttachment.file.name,
          type: fileAttachment.file.type,
          url: fileAttachment.downloadURL,
          gsURI: `gs://${snapshotRef.bucket}/${snapshotRef.fullPath}`,
        };
      }

      addMessageToFirestore(activeSessionId, {
        role: "user",
        content: userMessage.content,
        ...(userMessage.file ? { file: userMessage.file } : {}),
      });

      setMessages((prev) => [...prev, userMessage]);
      setFileAttachment(null);

      const assistantPlaceholderId = `local-assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantPlaceholderId,
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);

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
        const diagnosisURIs = userMessage.file?.gsURI
          ? [userMessage.file.gsURI]
          : [];

        const requestBody: Record<string, any> = {
          user_id: user.uid,
          session_id: agentSessionId,
          user_query: content,
          context_doc_uris: contextDocURIs,
          diagnosis_uris: diagnosisURIs,
          property_address: property?.address,
          property_id: property?.id, // Pass property_id for checkpoint queries
          analysis_optional_agents: selectedOptionalAgents,
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

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_AGENT_SSE_URL}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal,
          }
        );

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`API request failed: ${errorBody}`);
        }
        if (!response.body) throw new Error("The response body is empty.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let finalAssistantResponse = "";
        let agentSteps: AgentStep[] = [];
        const agentStatusRegex = /\*\*.*?Agent\*\* (\w+): (.+)/;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const rawChunk = decoder.decode(value, { stream: true });
          if (rawChunk.startsWith("STREAM_ERROR:")) {
            throw new Error(rawChunk.substring("STREAM_ERROR:".length));
          }

          const match = rawChunk.match(agentStatusRegex);
          if (match) {
            const status = match[1].toLowerCase() as
              | "transferredto"
              | "executing"
              | "completed"
              | "failed";
            const name = match[2];

            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === assistantPlaceholderId) {
                  const existingStepIndex =
                    m.agentSteps?.findIndex((step) => step.name === name) ?? -1;
                  let newAgentSteps: AgentStep[];

                  if (existingStepIndex > -1) {
                    newAgentSteps = m.agentSteps!.map((step, index) =>
                      index === existingStepIndex ? { ...step, status } : step
                    );
                  } else {
                    newAgentSteps = [...(m.agentSteps || []), { name, status }];
                  }
                  return { ...m, agentSteps: newAgentSteps };
                }
                return m;
              })
            );
          } else {
            finalAssistantResponse += rawChunk;
          }
        }

        if (!finalAssistantResponse.trim()) {
          finalAssistantResponse =
            "I'm sorry, I couldn't find a specific answer for that. Could you try rephrasing your question or providing more context?";
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantPlaceholderId
              ? { ...m, content: finalAssistantResponse, agentSteps: undefined }
              : m
          )
        );
        const newAssistantMessage = {
          role: "assistant" as const,
          content: finalAssistantResponse,
        };

        if (finalAssistantResponse.trim()) {
          addMessageToFirestore(activeSessionId, newAssistantMessage);
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
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantPlaceholderId
                ? { ...m, content: `Sorry, an error occurred: ${errorMessage}` }
                : m
            )
          );
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
      selectedOptionalAgents,
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
        <footer className="flex items-center p-4 bg-card border-t h-[84px]">
          <ChatInput
            onSend={handleSend}
            isLoading={isLoading}
            onStop={handleStop}
            fileAttachment={fileAttachment}
            onFileChange={handleFileUpload}
            onFileRemove={removeFileAttachment}
            placeholder="Type a message or attach image/video to diagnose an issue..."
            selectedOptionalAgents={selectedOptionalAgents}
            onOptionalAgentsChange={handleOptionalAgentsChange}
            locationData={locationData}
            onLocationDataChange={setLocationData}
            propertyAddress={property?.address}
          />
        </footer>
      </div>
    </div>
  );
}
