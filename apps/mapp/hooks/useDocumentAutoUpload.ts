import * as React from 'react';
import { Alert } from 'react-native';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { useDocumentUpload } from '@homeapp/common/contexts/document-upload-context';
import { queueExtractDocInfo, postFileToAgent } from '@/lib/api';
import {
  DOCUMENT_QUOTA_USER_MESSAGE,
  getDocumentAnalysisFailureMessage,
  isDocumentQuotaMessage,
} from '@homeapp/common/lib/document-analysis-errors';
import { isAtPlanLimit } from '@homeapp/common/lib/plan-limit-slice';
import { useLlmTokenUsage } from '@homeapp/common/contexts/llm-token-usage-context';
import { waitForUserDocAnalysis } from '@/lib/wait-user-doc-analysis';
import { createLogger } from '@/lib/logger';

const uploadLog = createLogger('upload');

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
  const { documentsLimit, limitsLoading } = useLlmTokenUsage();
  const hasUploadedFilesRef = React.useRef(false);

  React.useEffect(() => {
    if (!userId || !propertyId || !files) return;

    // Prevent duplicate uploads on remount/refresh
    if (hasUploadedFilesRef.current) {
      uploadLog.debug('batch.skipped.duplicate');
      return;
    }

    const startUpload = async () => {
      try {
        const parsedFiles = JSON.parse(files);
        if (!parsedFiles || parsedFiles.length === 0) return;

        if (!limitsLoading && isAtPlanLimit(documentsLimit, parsedFiles.length)) {
          Alert.alert('Monthly document limit reached', DOCUMENT_QUOTA_USER_MESSAGE);
          return;
        }

        uploadLog.info('batch.start', { count: parsedFiles.length });

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

            try {
              const ragResult = await postFileToAgent(gsURI, userId);
              let queueExtractError: unknown;
              try {
                await queueExtractDocInfo({
                  docId: docRef.id,
                  docUrl: gsURI,
                  contentType: doc.mimeType,
                  userId,
                });
              } catch (err) {
                queueExtractError = err;
              }

              if (queueExtractError) {
                throw new Error(getDocumentAnalysisFailureMessage(queueExtractError));
              }
              if (ragResult.error && isDocumentQuotaMessage(ragResult.error)) {
                throw new Error(ragResult.error);
              }
              if (!ragResult.success) {
                uploadLog.warn('rag.upload.failed', { error: ragResult.error });
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
            } catch (error) {
              const summary = getDocumentAnalysisFailureMessage(error);
              await updateDoc(docRef, { status: 'failed', summary });
              throw error;
            }
          },
          onComplete: async (completedDoc) => {
            try {
              if (!completedDoc.firestoreDocId) {
                removeUploadingDoc(completedDoc.id);
                return;
              }

              if (completedDoc.status === 'failed') {
                const failureMessage =
                  completedDoc.error ||
                  completedDoc.summary ||
                  'Document analysis could not be completed.';
                Alert.alert('Document upload', failureMessage);
                removeUploadingDoc(completedDoc.id);
                return;
              }

              uploadLog.info('analysis.complete', { name: completedDoc.name });

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
                  uploadLog.debug('property.address.autoUpdated');
                }
              }

              removeUploadingDoc(completedDoc.id);
            } catch (error) {
              uploadLog.error('postUpload.failed', undefined, error);
            }
          },
        });
      } catch (error) {
        uploadLog.error('batch.failed', undefined, error);
      }
    };

    startUpload();
  }, [
    userId,
    propertyId,
    files,
    storage,
    db,
    uploadDocuments,
    removeUploadingDoc,
    clearFilesParam,
    documentsLimit,
    limitsLoading,
  ]);
}
