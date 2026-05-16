import React, { createContext, useContext, useState, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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

interface DocumentUploadContextType {
  uploadingDocs: UploadingDocument[];
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

  const removeUploadingDoc = useCallback((docId: string) => {
    setUploadingDocs((prev) => prev.filter((doc) => doc.id !== docId));
  }, []);

  const clearUploadingDocs = useCallback(() => {
    setUploadingDocs([]);
  }, []);

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

      // Create uploading document objects
      const newDocs: UploadingDocument[] = assets.map((asset, index) => ({
        id: `doc-${Date.now()}-${index}`,
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType || 'application/octet-stream',
        size: asset.size || 0,
        progress: 0,
        status: 'uploading' as const,
      }));

      // Add to state
      setUploadingDocs((prev) => [...prev, ...newDocs]);

      // Upload each document
      for (const doc of newDocs) {
        try {
          // Update progress to show it started
          setUploadingDocs((prev) =>
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
                setUploadingDocs((prev) =>
                  prev.map((d) => (d.id === doc.id ? { ...d, progress } : d))
                );
              },
              (error) => {
                uploadLog.error('file.upload.failed', { name: doc.name }, error);
                setUploadingDocs((prev) =>
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
                  setUploadingDocs((prev) =>
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
                      uploadLog.warn('file.analysis.failed', { name: doc.name, cause: error instanceof Error ? error.message : String(error) });
                      analysisResult.summary = 'Analysis failed';
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

                  setUploadingDocs((prev) =>
                    prev.map((d) => (d.id === doc.id ? completedDoc : d))
                  );

                  // Call onComplete callback if provided
                  if (onComplete) {
                    onComplete(completedDoc);
                  }

                  resolve();
                } catch (error) {
                  uploadLog.error('file.process.failed', { name: doc.name }, error);
                  setUploadingDocs((prev) =>
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
          setUploadingDocs((prev) =>
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
    []
  );

  return (
    <DocumentUploadContext.Provider
      value={{
        uploadingDocs,
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
