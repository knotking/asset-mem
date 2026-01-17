"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Checkpoint, CheckpointMedia } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { useProperty } from "@/contexts/property-context";
import { useFirebase } from "@/contexts/firebase-context";

interface CheckpointContextType {
  checkpoints: Checkpoint[];
  loading: boolean;
  isLoadingEarlier: boolean;
  hasMoreCheckpoints: boolean;
  selectedCheckpoint: Checkpoint | null;
  setSelectedCheckpoint: (checkpoint: Checkpoint | null) => void;
  loadMoreCheckpoints: () => Promise<void>;
  createCheckpoint: (
    data: Partial<Checkpoint>,
    mediaFiles: { uri: string; type: "image" | "video" }[]
  ) => Promise<{ id: string; media: CheckpointMedia[] }>;
  updateCheckpoint: (id: string, data: Partial<Checkpoint>) => Promise<void>;
  deleteCheckpoint: (id: string) => Promise<void>;
  compareCheckpoints: (id1: string, id2: string) => Promise<void>;
}

const CheckpointContext = createContext<CheckpointContextType | undefined>(
  undefined
);

export const CheckpointProvider = ({ children }: { children: ReactNode }) => {
  const { db, storage } = useFirebase();
  const { user } = useAuth();
  const { property } = useProperty();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [hasMoreCheckpoints, setHasMoreCheckpoints] = useState(true);
  const [checkpointsLimit, setCheckpointsLimit] = useState(20);
  const [selectedCheckpoint, setSelectedCheckpoint] =
    useState<Checkpoint | null>(null);

  const loadMoreCheckpoints = useCallback(async () => {
    if (!user || !property || isLoadingEarlier || !hasMoreCheckpoints) {
      return;
    }

    setIsLoadingEarlier(true);
    try {
      const newLimit = checkpointsLimit + 20;
      setCheckpointsLimit(newLimit);
    } catch (err) {
      console.error("Error loading more checkpoints:", err);
    } finally {
      setIsLoadingEarlier(false);
    }
  }, [user, property, isLoadingEarlier, hasMoreCheckpoints, checkpointsLimit]);

  useEffect(() => {
    if (!user || !property) {
      setCheckpoints([]);
      setLoading(false);
      setHasMoreCheckpoints(true);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, `users/${user.uid}/properties/${property.id}/checkpoints`),
      orderBy("createdAt", "desc"),
      limit(checkpointsLimit)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const checkpointsData = snapshot.docs.map((doc) => {
          const data = doc.data();
          // Exclude embedding field for performance
          const { embedding, ...rest } = data;
          return {
            id: doc.id,
            ...rest,
          } as Checkpoint;
        });

        setCheckpoints(checkpointsData);
        setHasMoreCheckpoints(checkpointsData.length >= checkpointsLimit);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching checkpoints:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, user, property, checkpointsLimit]);

  const createCheckpoint = useCallback(
    async (
      data: Partial<Checkpoint>,
      mediaFiles: { uri: string; type: "image" | "video" }[]
    ): Promise<{ id: string; media: CheckpointMedia[] }> => {
      if (!user || !property) {
        throw new Error("User or property not found");
      }

      try {
        const uploadedMedia: CheckpointMedia[] = [];

        // Upload media files
        for (let i = 0; i < mediaFiles.length; i++) {
          const mediaFile = mediaFiles[i];
          const timestamp = Date.now();
          const fileName = `checkpoint_${timestamp}_${i}.${
            mediaFile.type === "video" ? "mp4" : "jpg"
          }`;
          const storagePath = `uploads/${user.uid}/properties/${property.id}/checkpoints/${fileName}`;
          const storageRef = ref(storage, storagePath);

          // Convert data URL to blob for web
          const response = await fetch(mediaFile.uri);
          const blob = await response.blob();

          // Upload to Firebase Storage
          await uploadBytes(storageRef, blob);
          const downloadURL = await getDownloadURL(storageRef);

          uploadedMedia.push({
            id: `media_${timestamp}_${i}`,
            url: downloadURL,
            gsURI: `gs://${storage.app.options.storageBucket}/${storagePath}`,
            contentType: blob.type,
            storagePath,
          });
        }

        // Create checkpoint document
        const checkpointData = {
          userId: user.uid,
          propertyId: property.id,
          name: data.name, // No fallback needed - always provided
          description: data.description || "",
          assetType: data.assetType || "real_estate",
          location: data.location || "",
          media: uploadedMedia,
          tags: data.tags || [],
          createdAt: serverTimestamp(),
          analysisStatus: "pending" as const,
        };

        const docRef = await addDoc(
          collection(
            db,
            `users/${user.uid}/properties/${property.id}/checkpoints`
          ),
          checkpointData
        );

        return { id: docRef.id, media: uploadedMedia };
      } catch (error) {
        console.error("Error creating checkpoint:", error);
        throw error;
      }
    },
    [user, property, db, storage]
  );

  const updateCheckpoint = useCallback(
    async (id: string, data: Partial<Checkpoint>) => {
      if (!user || !property) {
        throw new Error("User or property not found");
      }

      try {
        const docRef = doc(
          db,
          `users/${user.uid}/properties/${property.id}/checkpoints`,
          id
        );
        await updateDoc(docRef, {
          ...data,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error updating checkpoint:", error);
        throw error;
      }
    },
    [user, property, db]
  );

  const deleteCheckpoint = useCallback(
    async (id: string) => {
      if (!user || !property) {
        throw new Error("User or property not found");
      }

      try {
        const docRef = doc(
          db,
          `users/${user.uid}/properties/${property.id}/checkpoints`,
          id
        );
        await deleteDoc(docRef);
      } catch (error) {
        console.error("Error deleting checkpoint:", error);
        throw error;
      }
    },
    [user, property, db]
  );

  const compareCheckpoints = useCallback(async (id1: string, id2: string) => {
    // Comparison is handled by the comparison dialog component
    console.log("Compare checkpoints:", id1, id2);
  }, []);

  return (
    <CheckpointContext.Provider
      value={{
        checkpoints,
        loading,
        isLoadingEarlier,
        hasMoreCheckpoints,
        selectedCheckpoint,
        setSelectedCheckpoint,
        loadMoreCheckpoints,
        createCheckpoint,
        updateCheckpoint,
        deleteCheckpoint,
        compareCheckpoints,
      }}
    >
      {children}
    </CheckpointContext.Provider>
  );
};

export const useCheckpoint = () => {
  const context = useContext(CheckpointContext);
  if (context === undefined) {
    throw new Error("useCheckpoint must be used within a CheckpointProvider");
  }
  return context;
};
