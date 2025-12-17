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
import { Checkpoint, CheckpointMedia } from "../types";
import { useAuth } from "./auth-context";
import { useProperty } from "./property-context";
import { useFirebase } from "./firebase-context";

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
  const [checkpointsLimit, setCheckpointsLimit] = useState(20); // Start with 20 checkpoints
  const [selectedCheckpoint, setSelectedCheckpoint] =
    useState<Checkpoint | null>(null);

  // Function to load more checkpoints (pagination)
  const loadMoreCheckpoints = useCallback(async () => {
    if (!user || !property || isLoadingEarlier || !hasMoreCheckpoints) {
      return;
    }

    setIsLoadingEarlier(true);
    try {
      // Increase the limit to fetch more checkpoints
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
      limit(checkpointsLimit) // Add limit to query
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const checkpointsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Checkpoint[];

        setCheckpoints(checkpointsData);
        setLoading(false);

        // Check if there are more checkpoints available
        // If we got exactly the limit, there might be more
        setHasMoreCheckpoints(snapshot.docs.length >= checkpointsLimit);
      },
      (error) => {
        console.error("Error fetching checkpoints:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, property, db, checkpointsLimit]);

  const createCheckpoint = async (
    data: Partial<Checkpoint>,
    mediaFiles: { uri: string; type: "image" | "video" }[]
  ) => {
    if (!user || !property) throw new Error("No user or property selected");

    try {
      // 1. Upload media files
      const mediaPromises = mediaFiles.map(async (file, index) => {
        const extension = file.type === "video" ? "mp4" : "jpg";
        const fileName = `checkpoint_${Date.now()}_${index}.${extension}`;
        const storagePath = `uploads/${user.uid}/properties/${property.id}/checkpoints/${fileName}`;
        const storageRef = ref(storage, storagePath);

        const response = await fetch(file.uri);
        const blob = await response.blob();

        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);

        // For videos, generate + upload a thumbnail image so list items can display a preview.
        // We do a dynamic import so other platforms/builds that don't include this module
        // won't fail at import time.
        let thumbnailUrl: string | undefined;
        if (file.type === "video") {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const VideoThumbnails = await import("expo-video-thumbnails");
            const thumb = await VideoThumbnails.getThumbnailAsync(file.uri, {
              time: 1000,
            });

            if (thumb?.uri) {
              const thumbFileName = `checkpoint_${Date.now()}_${index}_thumb.jpg`;
              const thumbStoragePath = `uploads/${user.uid}/properties/${property.id}/checkpoints/${thumbFileName}`;
              const thumbRef = ref(storage, thumbStoragePath);

              const thumbResp = await fetch(thumb.uri);
              const thumbBlob = await thumbResp.blob();
              await uploadBytes(thumbRef, thumbBlob);
              thumbnailUrl = await getDownloadURL(thumbRef);
            }
          } catch (e) {
            console.warn("Failed to generate/upload video thumbnail:", e);
          }
        }

        return {
          id: fileName,
          url: downloadURL,
          gsURI: `gs://${storage.app.options.storageBucket}/${storagePath}`,
          contentType: file.type === "video" ? "video/mp4" : "image/jpeg",
          storagePath: storagePath,
          ...(thumbnailUrl ? { thumbnailUrl } : {}),
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

      // Update property checkpoint count (optional, can be done via cloud function trigger)
      // await updateDoc(doc(db, 'properties', property.id), {
      //   checkpointsCount: increment(1)
      // });

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
    // This will be implemented in Phase 8 (Cloud Function trigger)
    console.log("Triggering comparison for:", id1, id2);
    // For now, we just log. In future, this might call a cloud function directly
    // or update a document to trigger a background job.
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
