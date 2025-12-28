'use client';

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
import type { Checkpoint, CheckpointMedia } from "@/lib/types";
import { useAuth } from "./auth-context";
import { useProperty } from "./property-context";
import { db, storage } from "@/lib/firebase";

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
    mediaFiles: File[]
  ) => Promise<{ id: string; media: CheckpointMedia[] }>;
  updateCheckpoint: (id: string, data: Partial<Checkpoint>) => Promise<void>;
  deleteCheckpoint: (id: string) => Promise<void>;
  compareCheckpoints: (id1: string, id2: string) => Promise<void>;
}

const CheckpointContext = createContext<CheckpointContextType | undefined>(
  undefined
);

export const CheckpointProvider = ({ children }: { children: ReactNode }) => {
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
          // Exclude embedding fields to reduce memory usage
          const {
            embedding,
            embeddingModel,
            embeddingGeneratedAt,
            ...checkpointFields
          } = data;
          return {
            id: doc.id,
            ...checkpointFields,
          } as Checkpoint;
        });

        setCheckpoints(checkpointsData);
        setLoading(false);
        setHasMoreCheckpoints(snapshot.docs.length >= checkpointsLimit);
      },
      (error) => {
        console.error("Error fetching checkpoints:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, property, checkpointsLimit]);

  const createCheckpoint = async (
    data: Partial<Checkpoint>,
    mediaFiles: File[]
  ) => {
    if (!user || !property) throw new Error("No user or property selected");

    try {
      // 1. Upload media files
      const mediaPromises = mediaFiles.map(async (file, index) => {
        const extension = file.type.startsWith('video/') ? "mp4" : "jpg";
        const fileName = `checkpoint_${Date.now()}_${index}.${extension}`;
        const storagePath = `uploads/${user.uid}/properties/${property.id}/checkpoints/${fileName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        return {
          id: fileName,
          url: downloadURL,
          gsURI: `gs://${storage.app.options.storageBucket}/${storagePath}`,
          contentType: file.type,
          storagePath: storagePath,
        } as CheckpointMedia;
      });

      const uploadedMedia = await Promise.all(mediaPromises);

      // 2. Create checkpoint document
      const checkpointData: Partial<Checkpoint> = {
        ...data,
        userId: user.uid,
        propertyId: property.id,
        createdAt: serverTimestamp() as Timestamp,
        media: uploadedMedia,
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
  };

  const updateCheckpoint = async (id: string, data: Partial<Checkpoint>) => {
    if (!property || !user) return;
    const docRef = doc(
      db,
      `users/${user.uid}/properties/${property.id}/checkpoints`,
      id
    );
    await updateDoc(docRef, data);
  };

  const deleteCheckpoint = async (id: string) => {
    if (!property || !user) return;
    const docRef = doc(
      db,
      `users/${user.uid}/properties/${property.id}/checkpoints`,
      id
    );
    await deleteDoc(docRef);
  };

  const compareCheckpoints = async (id1: string, id2: string) => {
    console.log("Triggering comparison for:", id1, id2);
  };

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

