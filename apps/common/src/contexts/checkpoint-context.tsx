import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Checkpoint, CheckpointMedia } from '../types';
import { useAuth } from './auth-context';
import { useProperty } from './property-context';
import { useFirebase } from './firebase-context';

interface CheckpointContextType {
    checkpoints: Checkpoint[];
    loading: boolean;
    selectedCheckpoint: Checkpoint | null;
    setSelectedCheckpoint: (checkpoint: Checkpoint | null) => void;
    createCheckpoint: (data: Partial<Checkpoint>, mediaFiles: { uri: string; type: 'image' | 'video' }[]) => Promise<{ id: string; media: CheckpointMedia[] }>;
    updateCheckpoint: (id: string, data: Partial<Checkpoint>) => Promise<void>;
    deleteCheckpoint: (id: string) => Promise<void>;
    compareCheckpoints: (id1: string, id2: string) => Promise<void>;
}

const CheckpointContext = createContext<CheckpointContextType | undefined>(undefined);

export const CheckpointProvider = ({ children }: { children: ReactNode }) => {
    const { db, storage } = useFirebase();
    const { user } = useAuth();
    const { property } = useProperty();
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);

    useEffect(() => {
        if (!user || !property) {
            setCheckpoints([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = query(
            collection(db, `properties/${property.id}/checkpoints`),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const checkpointsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Checkpoint[];

            setCheckpoints(checkpointsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching checkpoints:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, property]);

    const createCheckpoint = async (data: Partial<Checkpoint>, mediaFiles: { uri: string; type: 'image' | 'video' }[]) => {
        if (!user || !property) throw new Error("No user or property selected");

        try {
            // 1. Upload media files
            const mediaPromises = mediaFiles.map(async (file, index) => {
                const extension = file.type === 'video' ? 'mp4' : 'jpg';
                const fileName = `checkpoint_${Date.now()}_${index}.${extension}`;
                const storagePath = `properties/${property.id}/checkpoints/${fileName}`;
                const storageRef = ref(storage, storagePath);

                const response = await fetch(file.uri);
                const blob = await response.blob();

                await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(storageRef);

                return {
                    id: fileName,
                    url: downloadURL,
                    gsURI: `gs://${storage.app.options.storageBucket}/${storagePath}`,
                    contentType: file.type === 'video' ? 'video/mp4' : 'image/jpeg',
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

            const docRef = await addDoc(collection(db, `properties/${property.id}/checkpoints`), checkpointData);

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
        if (!property) return;
        const docRef = doc(db, `properties/${property.id}/checkpoints`, id);
        await updateDoc(docRef, data);
    };

    const deleteCheckpoint = async (id: string) => {
        if (!property) return;
        const docRef = doc(db, `properties/${property.id}/checkpoints`, id);
        await deleteDoc(docRef);
    };

    const compareCheckpoints = async (id1: string, id2: string) => {
        // This will be implemented in Phase 8 (Cloud Function trigger)
        console.log("Triggering comparison for:", id1, id2);
        // For now, we just log. In future, this might call a cloud function directly
        // or update a document to trigger a background job.
    };

    return (
        <CheckpointContext.Provider value={{
            checkpoints,
            loading,
            selectedCheckpoint,
            setSelectedCheckpoint,
            createCheckpoint,
            updateCheckpoint,
            deleteCheckpoint,
            compareCheckpoints
        }}>
            {children}
        </CheckpointContext.Provider>
    );
};

export const useCheckpoint = () => {
    const context = useContext(CheckpointContext);
    if (context === undefined) {
        throw new Error('useCheckpoint must be used within a CheckpointProvider');
    }
    return context;
};
