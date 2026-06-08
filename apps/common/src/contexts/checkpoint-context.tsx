import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  startAfter,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Checkpoint, CheckpointMedia } from "../types";
import { useAuth } from "./auth-context";
import { useProperty } from "./property-context";
import { useFirebase } from "./firebase-context";
import { createLogger, truncateId } from "../lib/logger";
import { useDeletionConfig } from "./deletion-config-context";
import { useOptimisticDeletionOverlay } from "../hooks/use-optimistic-deletion-overlay";

const checkpointLog = createLogger("checkpoint");

/** Live listener window + each "load more" page size. */
export const CHECKPOINT_PAGE_SIZE = 20;

function mapCheckpointDoc(
  docSnap: QueryDocumentSnapshot<DocumentData>
): Checkpoint {
  const data = docSnap.data();
  const {
    embedding,
    embeddingModel,
    embeddingGeneratedAt,
    ...checkpointFields
  } = data;
  return {
    id: docSnap.id,
    ...checkpointFields,
  } as Checkpoint;
}

function sortCheckpointsNewestFirst(list: Checkpoint[]): Checkpoint[] {
  return [...list].sort((a, b) => {
    const aMs =
      a.createdAt instanceof Timestamp
        ? a.createdAt.toMillis()
        : a.createdAt
          ? new Date(a.createdAt as Date).getTime()
          : 0;
    const bMs =
      b.createdAt instanceof Timestamp
        ? b.createdAt.toMillis()
        : b.createdAt
          ? new Date(b.createdAt as Date).getTime()
          : 0;
    return bMs - aMs;
  });
}

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
  markCheckpointsDeleting: (ids: string[]) => void;
  clearCheckpointsDeleting: (ids: string[]) => void;
  isCheckpointDeletingOverlay: (
    checkpoint: Pick<Checkpoint, "id" | "deletionStatus"> | null | undefined
  ) => boolean;
}

const CheckpointContext = createContext<CheckpointContextType | undefined>(
  undefined
);

export const CheckpointProvider = ({ children }: { children: ReactNode }) => {
  const { db, storage } = useFirebase();
  const { user } = useAuth();
  const { property } = useProperty();
  const [liveCheckpoints, setLiveCheckpoints] = useState<Checkpoint[]>([]);
  const [olderCheckpoints, setOlderCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [hasMoreCheckpoints, setHasMoreCheckpoints] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] =
    useState<Checkpoint | null>(null);

  const liveTailRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const olderTailRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const olderPageFullRef = useRef(false);
  const livePageFullRef = useRef(false);

  const checkpoints = useMemo(() => {
    const byId = new Map<string, Checkpoint>();
    for (const cp of liveCheckpoints) {
      byId.set(cp.id, cp);
    }
    for (const cp of olderCheckpoints) {
      if (!byId.has(cp.id)) {
        byId.set(cp.id, cp);
      }
    }
    return sortCheckpointsNewestFirst(Array.from(byId.values()));
  }, [liveCheckpoints, olderCheckpoints]);

  const resetPagination = useCallback(() => {
    setLiveCheckpoints([]);
    setOlderCheckpoints([]);
    liveTailRef.current = null;
    olderTailRef.current = null;
    olderPageFullRef.current = false;
    livePageFullRef.current = false;
    setHasMoreCheckpoints(false);
  }, []);

  const loadMoreCheckpoints = useCallback(async () => {
    if (!user || !property || isLoadingEarlier || !hasMoreCheckpoints) {
      return;
    }

    const tail = olderTailRef.current ?? liveTailRef.current;
    if (!tail) {
      return;
    }

    setIsLoadingEarlier(true);
    try {
      const q = query(
        collection(
          db,
          `users/${user.uid}/properties/${property.id}/checkpoints`
        ),
        orderBy("createdAt", "desc"),
        startAfter(tail),
        limit(CHECKPOINT_PAGE_SIZE)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        olderPageFullRef.current = false;
        setHasMoreCheckpoints(livePageFullRef.current);
        return;
      }

      const page = snapshot.docs.map(mapCheckpointDoc);
      setOlderCheckpoints((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        const merged = [...prev];
        for (const cp of page) {
          if (!ids.has(cp.id)) {
            merged.push(cp);
          }
        }
        return merged;
      });
      olderTailRef.current = snapshot.docs[snapshot.docs.length - 1] ?? null;
      olderPageFullRef.current =
        snapshot.docs.length >= CHECKPOINT_PAGE_SIZE;
      setHasMoreCheckpoints(
        olderPageFullRef.current || livePageFullRef.current
      );
    } catch (err) {
      checkpointLog.error("checkpoints.loadMore.failed", undefined, err);
    } finally {
      setIsLoadingEarlier(false);
    }
  }, [user, property, isLoadingEarlier, hasMoreCheckpoints, db]);

  useEffect(() => {
    if (!user || !property) {
      resetPagination();
      setLoading(false);
      return;
    }

    resetPagination();
    setLoading(true);

    const q = query(
      collection(db, `users/${user.uid}/properties/${property.id}/checkpoints`),
      orderBy("createdAt", "desc"),
      limit(CHECKPOINT_PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const page = snapshot.docs.map(mapCheckpointDoc);
        setLiveCheckpoints(page);
        liveTailRef.current = snapshot.docs[snapshot.docs.length - 1] ?? null;
        livePageFullRef.current =
          snapshot.docs.length >= CHECKPOINT_PAGE_SIZE;
        setHasMoreCheckpoints(
          livePageFullRef.current || olderPageFullRef.current
        );
        setLoading(false);
      },
      (error) => {
        checkpointLog.error("checkpoints.fetch.failed", undefined, error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, user, property?.id, resetPagination]);

  const createCheckpoint = async (
    data: Partial<Checkpoint>,
    mediaFiles: { uri: string; type: "image" | "video" }[]
  ) => {
    if (!user || !property) throw new Error("No user or property selected");

    try {
      const mediaPromises = mediaFiles.map(async (file, index) => {
        const extension = file.type === "video" ? "mp4" : "jpg";
        const fileName = `checkpoint_${Date.now()}_${index}.${extension}`;
        const storagePath = `uploads/${user.uid}/properties/${property.id}/checkpoints/${fileName}`;
        const storageRef = ref(storage, storagePath);

        const response = await fetch(file.uri);
        const blob = await response.blob();

        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);

        let thumbnailUrl: string | undefined;
        if (file.type === "video") {
          try {
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
            checkpointLog.warn("checkpoint.thumbnail.failed");
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
      checkpointLog.error("checkpoint.create.failed", undefined, error);
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

  const deletionConfig = useDeletionConfig();
  const {
    markDeleting: markCheckpointsDeleting,
    clearDeleting: clearCheckpointsDeleting,
    isDeletingOverlay: isCheckpointDeletingOverlay,
  } = useOptimisticDeletionOverlay();

  const deleteCheckpoint = async (id: string) => {
    if (!property || !user) return;
    markCheckpointsDeleting([id]);
    const checkpoint =
      liveCheckpoints.find((c) => c.id === id) ??
      olderCheckpoints.find((c) => c.id === id) ??
      null;
    try {
        const { deleteCheckpointWithMedia } = await import("../lib/deletion/delete-checkpoint");
      const result = await deleteCheckpointWithMedia({
        db,
        storage,
        userId: user.uid,
        propertyId: property.id,
        checkpointId: id,
        checkpoint,
        checkpointDeleteUrl: deletionConfig?.urls?.checkpoint,
        getIdToken: deletionConfig?.getIdToken,
      });
      if (!result.ok) {
        throw new Error(result.failed[0]?.message ?? "Checkpoint delete failed");
      }
      setOlderCheckpoints((prev) => prev.filter((c) => c.id !== id));
      setLiveCheckpoints((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      const { markCheckpointDeletionFailed } = await import("../lib/deletion");
      await markCheckpointDeletionFailed(db, user.uid, property.id, id, error);
      throw error;
    } finally {
      clearCheckpointsDeleting([id]);
    }
  };

  const compareCheckpoints = async (id1: string, id2: string) => {
    checkpointLog.debug("checkpoint.compare", {
      id1: truncateId(id1),
      id2: truncateId(id2),
    });
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
        markCheckpointsDeleting,
        clearCheckpointsDeleting,
        isCheckpointDeletingOverlay,
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
