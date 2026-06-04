import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getDocumentAnalysisFailureMessage } from '../lib/document-analysis-errors';
import { createLogger } from '../lib/logger';

const uploadLog = createLogger('upload');

export type UploadingDocument = {
  id: string;
  name: string;
  uri: string;
  mimeType: string;
  size: number;
  progress: number;
  status: 'uploading' | 'analyzing' | 'complete' | 'failed';
  error?: string;
  downloadURL?: string;
  storagePath?: string;
  gsURI?: string;
  documentType?: string;
  propertyAddress?: string;
  keyEntities?: Array<{ name: string; value: string }>;
  summary?: string;
  /** Firestore `users/{uid}/docs/{id}` when analysis is async */
  firestoreDocId?: string;
};

export type DocumentPickerAsset = {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
};

function mergeUploadingDocs(
  prev: UploadingDocument[],
  assets: DocumentPickerAsset[]
): UploadingDocument[] {
  const existingUris = new Set(prev.map((doc) => doc.uri));
  const stamp = Date.now();
  const toAdd: UploadingDocument[] = [];

  assets.forEach((asset, index) => {
    if (existingUris.has(asset.uri)) {
      return;
    }
    existingUris.add(asset.uri);
    toAdd.push({
      id: `doc-${stamp}-${index}`,
      name: asset.name,
      uri: asset.uri,
      mimeType: asset.mimeType || 'application/octet-stream',
      size: asset.size || 0,
      progress: 0,
      status: 'uploading',
    });
  });

  return [...prev, ...toAdd];
}

interface DocumentUploadContextType {
  uploadingDocs: UploadingDocument[];
  /** Show in-progress rows before upload starts (e.g. right after navigation). */
  primeUploadingDocuments: (assets: DocumentPickerAsset[]) => void;
  uploadDocuments: (
    assets: DocumentPickerAsset[],
    options: {
      userId: string;
      storage: any;
      onAnalyze?: (
        doc: UploadingDocument,
        gsURI: string,
        meta: { downloadURL: string; storagePath: string }
      ) => Promise<{
        documentType?: string;
        propertyAddress?: string;
        keyEntities?: Array<{ name: string; value: string }>;
        summary?: string;
        /** When analysis writes to Firestore asynchronously, clients set this for onComplete. */
        firestoreDocId?: string;
      }>;
      onComplete?: (doc: UploadingDocument) => void;
    }
  ) => Promise<void>;
  removeUploadingDoc: (docId: string) => void;
  clearUploadingDocs: () => void;
}

const DocumentUploadContext = createContext<DocumentUploadContextType | undefined>(undefined);

export const DocumentUploadProvider = ({ children }: { children: React.ReactNode }) => {
  const [uploadingDocs, setUploadingDocs] = useState<UploadingDocument[]>([]);
  const uploadingDocsRef = useRef<UploadingDocument[]>([]);

  const syncUploadingDocs = useCallback(
    (updater: (prev: UploadingDocument[]) => UploadingDocument[]) => {
      setUploadingDocs((prev) => {
        const next = updater(prev);
        uploadingDocsRef.current = next;
        return next;
      });
    },
    []
  );

  const removeUploadingDoc = useCallback((docId: string) => {
    syncUploadingDocs((prev) => prev.filter((doc) => doc.id !== docId));
  }, [syncUploadingDocs]);

  const clearUploadingDocs = useCallback(() => {
    syncUploadingDocs(() => []);
  }, [syncUploadingDocs]);

  const primeUploadingDocuments = useCallback(
    (assets: DocumentPickerAsset[]) => {
      if (assets.length === 0) {
        return;
      }
      syncUploadingDocs((prev) => mergeUploadingDocs(prev, assets));
    },
    [syncUploadingDocs]
  );

  const uploadDocuments = useCallback(
    async (
      assets: DocumentPickerAsset[],
      options: {
        userId: string;
        storage: any;
        onAnalyze?: (
          doc: UploadingDocument,
          gsURI: string,
          meta: { downloadURL: string; storagePath: string }
        ) => Promise<{
          documentType?: string;
          propertyAddress?: string;
          keyEntities?: Array<{ name: string; value: string }>;
          summary?: string;
          firestoreDocId?: string;
        }>;
        onComplete?: (doc: UploadingDocument) => void;
      }
    ) => {
      const { userId, storage, onAnalyze, onComplete } = options;

      syncUploadingDocs((prev) => mergeUploadingDocs(prev, assets));

      const docsToProcess = assets
        .map((asset) => uploadingDocsRef.current.find((doc) => doc.uri === asset.uri))
        .filter((doc): doc is UploadingDocument => !!doc);

      // Upload each document
      for (const doc of docsToProcess) {
        try {
          // Update progress to show it started
          syncUploadingDocs((prev) =>
            prev.map((d) => (d.id === doc.id ? { ...d, progress: 1 } : d))
          );

          // Read file using fetch API
          uploadLog.debug('file.read', { name: doc.name });
          const response = await fetch(doc.uri);
          const blob = await response.blob();
          uploadLog.debug('file.loaded', { type: blob.type, size: blob.size });

          // Create storage reference
          const storageRef = ref(storage, `documents/${userId}/${Date.now()}_${doc.name}`);
          uploadLog.debug('file.uploading', { path: storageRef.fullPath });

          // Upload with progress tracking
          const uploadTask = uploadBytesResumable(storageRef, blob, {
            contentType: doc.mimeType,
          });

          await new Promise<void>((resolve, reject) => {
            uploadTask.on(
              'state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                syncUploadingDocs((prev) =>
                  prev.map((d) => (d.id === doc.id ? { ...d, progress } : d))
                );
              },
              (error) => {
                uploadLog.error('file.upload.failed', { name: doc.name }, error);
                syncUploadingDocs((prev) =>
                  prev.map((d) =>
                    d.id === doc.id ? { ...d, status: 'failed', error: error.message } : d
                  )
                );
                reject(error);
              },
              async () => {
                try {
                  const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                  const gsURI = `gs://${storageRef.bucket}/${storageRef.fullPath}`;

                  // Update status to analyzing
                  syncUploadingDocs((prev) =>
                    prev.map((d) =>
                      d.id === doc.id
                        ? {
                            ...d,
                            status: 'analyzing',
                            progress: 100,
                            downloadURL,
                            storagePath: storageRef.fullPath,
                            gsURI,
                          }
                        : d
                    )
                  );

                  // Run analysis if provided
                  let analysisResult: {
                    documentType?: string;
                    propertyAddress?: string;
                    keyEntities?: Array<{ name: string; value: string }>;
                    summary?: string;
                  } = {};

                  if (onAnalyze) {
                    try {
                      analysisResult = await onAnalyze(doc, gsURI, {
                        downloadURL,
                        storagePath: storageRef.fullPath,
                      });
                    } catch (error) {
                      const failureMessage = getDocumentAnalysisFailureMessage(error);
                      uploadLog.warn('file.analysis.failed', {
                        name: doc.name,
                        cause: failureMessage,
                      });
                      syncUploadingDocs((prev) =>
                        prev.map((d) =>
                          d.id === doc.id
                            ? {
                                ...d,
                                status: 'failed',
                                error: failureMessage,
                                summary: failureMessage,
                              }
                            : d
                        )
                      );
                      if (onComplete) {
                        onComplete({
                          ...doc,
                          status: 'failed',
                          error: failureMessage,
                          summary: failureMessage,
                          downloadURL,
                          storagePath: storageRef.fullPath,
                          gsURI,
                          progress: 100,
                        });
                      }
                      resolve();
                      return;
                    }
                  }

                  // Update document with complete status
                  const completedDoc: UploadingDocument = {
                    ...doc,
                    status: 'complete',
                    downloadURL,
                    storagePath: storageRef.fullPath,
                    gsURI,
                    progress: 100,
                    ...analysisResult,
                  };

                  syncUploadingDocs((prev) =>
                    prev.map((d) => (d.id === doc.id ? completedDoc : d))
                  );

                  // Call onComplete callback if provided
                  if (onComplete) {
                    onComplete(completedDoc);
                  }

                  resolve();
                } catch (error) {
                  uploadLog.error('file.process.failed', { name: doc.name }, error);
                  syncUploadingDocs((prev) =>
                    prev.map((d) =>
                      d.id === doc.id ? { ...d, status: 'failed', error: 'Processing failed' } : d
                    )
                  );
                  reject(error);
                }
              }
            );
          });
        } catch (error) {
          uploadLog.error('file.upload.failed', { name: doc.name }, error);
          syncUploadingDocs((prev) =>
            prev.map((d) =>
              d.id === doc.id
                ? {
                    ...d,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Upload failed',
                  }
                : d
            )
          );
        }
      }
    },
    [syncUploadingDocs]
  );

  return (
    <DocumentUploadContext.Provider
      value={{
        uploadingDocs,
        primeUploadingDocuments,
        uploadDocuments,
        removeUploadingDoc,
        clearUploadingDocs,
      }}>
      {children}
    </DocumentUploadContext.Provider>
  );
};

export const useDocumentUpload = () => {
  const context = useContext(DocumentUploadContext);
  if (context === undefined) {
    throw new Error('useDocumentUpload must be used within a DocumentUploadProvider');
  }
  return context;
};
