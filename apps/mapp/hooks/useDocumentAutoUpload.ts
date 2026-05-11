import * as React from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { useDocumentUpload } from '@homeapp/common/contexts/document-upload-context';
import { queueExtractDocInfo, postFileToAgent } from '@/lib/api';
import { waitForUserDocAnalysis } from '@/lib/wait-user-doc-analysis';

interface UseDocumentAutoUploadParams {
  files: string | undefined;
  userId: string | undefined;
  propertyId: string;
  db: Firestore;
  storage: FirebaseStorage;
  clearFilesParam: () => void;
}

export function useDocumentAutoUpload({
  files,
  userId,
  propertyId,
  db,
  storage,
  clearFilesParam,
}: UseDocumentAutoUploadParams) {
  const { uploadDocuments, removeUploadingDoc } = useDocumentUpload();
  const hasUploadedFilesRef = React.useRef(false);

  React.useEffect(() => {
    if (!userId || !propertyId || !files) return;

    // Prevent duplicate uploads on remount/refresh
    if (hasUploadedFilesRef.current) {
      console.log('Files already uploaded, skipping duplicate upload');
      return;
    }

    const startUpload = async () => {
      try {
        const parsedFiles = JSON.parse(files);
        if (!parsedFiles || parsedFiles.length === 0) return;

        console.log('Starting upload for', parsedFiles.length, 'files');

        // Mark as uploaded to prevent duplicates
        hasUploadedFilesRef.current = true;

        // Clear the files parameter from route to prevent re-upload on remount
        clearFilesParam();

        // Start uploading using the common hook
        await uploadDocuments(parsedFiles, {
          userId,
          storage,
          onAnalyze: async (doc, gsURI, meta) => {
            const docRef = await addDoc(collection(db, 'users', userId, 'docs'), {
              userId,
              propertyId,
              name: doc.name,
              url: meta.downloadURL,
              storagePath: meta.storagePath,
              createdAt: serverTimestamp(),
              gsURI,
              contentType: doc.mimeType,
              status: 'analyzing',
              summary: 'Processing...',
            });

            const [queueResult, ragResult] = await Promise.allSettled([
              queueExtractDocInfo({
                docId: docRef.id,
                docUrl: gsURI,
                contentType: doc.mimeType,
                userId,
              }),
              postFileToAgent(gsURI, userId),
            ]);

            if (ragResult.status === 'rejected') {
              console.warn('RAG upload failed (non-blocking):', ragResult.reason);
            }

            if (queueResult.status === 'rejected') {
              console.warn('Queue document analysis failed:', queueResult.reason);
              throw queueResult.reason;
            }

            const data = await waitForUserDocAnalysis(db, userId, docRef.id);
            if (data.status === 'failed') {
              throw new Error(
                typeof data.summary === 'string' ? data.summary : 'Document analysis failed'
              );
            }

            return {
              documentType: typeof data.documentType === 'string' ? data.documentType : 'OTHER',
              propertyAddress:
                typeof data.propertyAddress === 'string' ? data.propertyAddress : 'N/A',
              keyEntities: Array.isArray(data.keyEntities) ? data.keyEntities : [],
              summary: typeof data.summary === 'string' ? data.summary : 'No summary available',
              firestoreDocId: docRef.id,
            };
          },
          onComplete: async (completedDoc) => {
            try {
              if (!completedDoc.firestoreDocId) {
                removeUploadingDoc(completedDoc.id);
                return;
              }

              console.log('Document analysis finished:', completedDoc.name);

              if (
                completedDoc.propertyAddress &&
                completedDoc.propertyAddress !== 'N/A' &&
                completedDoc.propertyAddress !== 'Processing...'
              ) {
                const propertyRef = doc(db, 'users', userId, 'properties', propertyId);
                const propertyDoc = await getDoc(propertyRef);
                const propertyData = propertyDoc.data();
                const currentAddress = propertyData?.address;

                if (currentAddress === 'Processing...') {
                  await updateDoc(propertyRef, {
                    address: completedDoc.propertyAddress,
                    name: completedDoc.propertyAddress,
                  });
                  console.log('Auto-updated property address to:', completedDoc.propertyAddress);
                }
              }

              removeUploadingDoc(completedDoc.id);
            } catch (error) {
              console.error('Error after document upload:', error);
            }
          },
        });
      } catch (error) {
        console.error('Error parsing or uploading files:', error);
      }
    };

    startUpload();
  }, [userId, propertyId, files, storage, db, uploadDocuments, removeUploadingDoc, clearFilesParam]);
}
