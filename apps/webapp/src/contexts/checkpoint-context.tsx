"use client";

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
import { Checkpoint, CheckpointMedia } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { useProperty } from "@/contexts/property-context";
import { useFirebase } from "@/contexts/firebase-context";
import { createLogger, truncateId } from "@/lib/logger";

const checkpointLog = createLogger("checkpoint");

export const CHECKPOINT_PAGE_SIZE = 20;

function mapCheckpointDoc(
  docSnap: QueryDocumentSnapshot<DocumentData>
): Checkpoint {
  const data = docSnap.data();
  const { embedding, ...rest } = data;
  return {
    id: docSnap.id,
    ...rest,
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
        setLiveCheckpoints(snapshot.docs.map(mapCheckpointDoc));
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

        for (let i = 0; i < mediaFiles.length; i++) {
          const mediaFile = mediaFiles[i];
          const timestamp = Date.now();
          const fileName = `checkpoint_${timestamp}_${i}.${
            mediaFile.type === "video" ? "mp4" : "jpg"
          }`;
          const storagePath = `uploads/${user.uid}/properties/${property.id}/checkpoints/${fileName}`;
          const storageRef = ref(storage, storagePath);

          const response = await fetch(mediaFile.uri);
          const blob = await response.blob();

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

        const checkpointData = {
          userId: user.uid,
          propertyId: property.id,
          name: data.name,
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
        checkpointLog.error("checkpoint.create.failed", undefined, error);
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
        checkpointLog.error("checkpoint.update.failed", undefined, error);
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
        setOlderCheckpoints((prev) => prev.filter((c) => c.id !== id));
        setLiveCheckpoints((prev) => prev.filter((c) => c.id !== id));
      } catch (error) {
        checkpointLog.error("checkpoint.delete.failed", undefined, error);
        throw error;
      }
    },
    [user, property, db]
  );

  const compareCheckpoints = useCallback(async (id1: string, id2: string) => {
    checkpointLog.debug("checkpoint.compare", {
      id1: truncateId(id1),
      id2: truncateId(id2),
    });
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
