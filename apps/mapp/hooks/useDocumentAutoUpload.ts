import * as React from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { useDocumentUpload } from '@homeapp/common/contexts/document-upload-context';
import { extractDocInfo, postFileToAgent } from '@/lib/api';

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
          onAnalyze: async (doc, gsURI) => {
            // Run AI analysis and RAG upload in parallel
            const [analysisResult] = await Promise.allSettled([
              extractDocInfo({ docUrl: gsURI, contentType: doc.mimeType }),
              postFileToAgent(gsURI, userId),
            ]);

            if (analysisResult.status === 'fulfilled') {
              return analysisResult.value;
            } else {
              console.warn('Analysis failed (non-blocking):', analysisResult.reason);
              return { summary: 'Analysis failed' };
            }
          },
          onComplete: async (completedDoc) => {
            try {
              // Save to Firestore
              await addDoc(collection(db, 'users', userId, 'docs'), {
                userId: userId,
                propertyId: propertyId,
                name: completedDoc.name,
                url: completedDoc.downloadURL,
                storagePath: completedDoc.storagePath,
                createdAt: serverTimestamp(),
                gsURI: completedDoc.gsURI,
                contentType: completedDoc.mimeType,
                status: 'complete',
                documentType: completedDoc.documentType || 'OTHER',
                propertyAddress: completedDoc.propertyAddress || 'N/A',
                keyEntities: completedDoc.keyEntities || [],
                summary: completedDoc.summary || 'No summary available',
              });

              console.log('Document saved to Firestore:', completedDoc.name);

              // If document has a valid address, auto-update property address
              if (
                completedDoc.propertyAddress &&
                completedDoc.propertyAddress !== 'N/A' &&
                completedDoc.propertyAddress !== 'Processing...'
              ) {
                const propertyRef = doc(db, 'users', userId, 'properties', propertyId);
                const propertyDoc = await getDoc(propertyRef);
                const propertyData = propertyDoc.data();
                const currentAddress = propertyData?.address;

                // Auto-update if current address is "Processing..."
                if (currentAddress === 'Processing...') {
                  await updateDoc(propertyRef, {
                    address: completedDoc.propertyAddress,
                    name: completedDoc.propertyAddress,
                  });
                  console.log('Auto-updated property address to:', completedDoc.propertyAddress);
                }
              }

              // Remove from uploading list immediately
              removeUploadingDoc(completedDoc.id);
            } catch (error) {
              console.error('Error saving document to Firestore:', error);
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
