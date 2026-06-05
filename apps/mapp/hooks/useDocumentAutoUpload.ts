import * as React from 'react';
import { Alert } from 'react-native';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import {
  useDocumentUpload,
  type DocumentPickerAsset,
} from '@homeapp/common/contexts/document-upload-context';
import { queueExtractDocInfo, postFileToAgent } from '@/lib/api';
import {
  DOCUMENT_QUOTA_USER_MESSAGE,
  getDocumentAnalysisFailureMessage,
  isDocumentQuotaMessage,
} from '@homeapp/common/lib/document-analysis-errors';
import { isAtPlanLimit } from '@homeapp/common/lib/plan-limit-slice';
import { useLlmTokenUsage } from '@homeapp/common/contexts/llm-token-usage-context';
import { waitForUserDocAnalysis } from '@/lib/wait-user-doc-analysis';
import { isPlaceholderPropertyAddress } from '@/lib/property-address-placeholder';
import {
  clearPendingPropertyUpload,
  consumePendingPropertyUpload,
  peekPendingPropertyUpload,
} from '@/lib/pending-property-upload';
import { createLogger } from '@/lib/logger';

const uploadLog = createLogger('upload');

/** Survives Strict Mode remounts so limit alerts are not shown twice in quick succession. */
let lastDocumentLimitAlertKey: string | null = null;
let lastDocumentLimitAlertAt = 0;

function alertDocumentLimitOnce(propertyId: string): void {
  const key = propertyId;
  const now = Date.now();
  if (lastDocumentLimitAlertKey === key && now - lastDocumentLimitAlertAt < 2500) {
    return;
  }
  lastDocumentLimitAlertKey = key;
  lastDocumentLimitAlertAt = now;
  Alert.alert('Monthly document limit reached', DOCUMENT_QUOTA_USER_MESSAGE);
}

interface UseDocumentAutoUploadParams {
  files: string | string[] | undefined;
  userId: string | undefined;
  propertyId: string | undefined;
  db: Firestore;
  storage: FirebaseStorage;
  clearFilesParam: () => void;
}

function parseFilesParam(files: string | string[] | undefined): DocumentPickerAsset[] | null {
  const raw = Array.isArray(files) ? files[0] : files;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DocumentPickerAsset[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    uploadLog.warn('files.param.parse.failed');
    return null;
  }
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
  const handledForPropertyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!userId || !propertyId || propertyId === 'new-property') {
      return;
    }

    if (handledForPropertyRef.current === propertyId) {
      uploadLog.debug('batch.skipped.duplicate');
      return;
    }

    if (limitsLoading) {
      return;
    }

    const routeFiles = parseFilesParam(files);
    const pendingPeek = peekPendingPropertyUpload(propertyId);
    const assets = pendingPeek ?? routeFiles;
    if (!assets || assets.length === 0) {
      return;
    }

    if (isAtPlanLimit(documentsLimit, assets.length)) {
      consumePendingPropertyUpload(propertyId);
      clearPendingPropertyUpload(propertyId);
      clearFilesParam();
      handledForPropertyRef.current = propertyId;
      alertDocumentLimitOnce(propertyId);
      return;
    }

    const startUpload = async () => {
      try {
        const filesToUpload = consumePendingPropertyUpload(propertyId) ?? routeFiles;
        if (!filesToUpload || filesToUpload.length === 0) {
          return;
        }

        uploadLog.info('batch.start', { count: filesToUpload.length, propertyId });

        handledForPropertyRef.current = propertyId;
        clearFilesParam();

        await uploadDocuments(filesToUpload, {
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
              ragIndexed: false,
              summary: 'Processing...',
            });

            try {
              const ragResult = await postFileToAgent(gsURI, userId, docRef.id);
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
                if (!isDocumentQuotaMessage(failureMessage)) {
                  Alert.alert('Document upload', failureMessage);
                }
                removeUploadingDoc(completedDoc.id);
                return;
              }

              uploadLog.info('analysis.complete', { name: completedDoc.name });

              if (
                completedDoc.propertyAddress &&
                completedDoc.propertyAddress !== 'N/A' &&
                !isPlaceholderPropertyAddress(completedDoc.propertyAddress)
              ) {
                const propertyRef = doc(db, 'users', userId, 'properties', propertyId);
                const propertyDoc = await getDoc(propertyRef);
                const propertyData = propertyDoc.data();
                const currentAddress = propertyData?.address;

                if (isPlaceholderPropertyAddress(currentAddress)) {
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
        handledForPropertyRef.current = null;
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
