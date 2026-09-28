import * as React from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { FileAttachment } from '@asset-mem/common/types';
import type { FirebaseStorage } from 'firebase/storage';
import { createLogger } from '@/lib/logger';

const uploadLog = createLogger('upload');

export function useFileUpload(storage: FirebaseStorage, userId: string | undefined) {
  const [fileAttachment, setFileAttachment] = React.useState<FileAttachment | null>(null);

  const generateFileName = React.useCallback((asset: ImagePicker.ImagePickerAsset) => {
    const timestamp = Date.now();
    let fileName = asset.fileName;
    const fileNameWithoutExt = fileName ? fileName.replace(/\.[^/.]+$/, '') : '';

    if (!fileName || /^\d+$/.test(fileNameWithoutExt)) {
      const uriParts = asset.uri.split('/');
      const uriFileName = uriParts[uriParts.length - 1];
      const decodedFileName = uriFileName ? decodeURIComponent(uriFileName) : '';

      if (decodedFileName && decodedFileName.includes('.')) {
        const uriFileNameWithoutExt = decodedFileName.replace(/\.[^/.]+$/, '');
        if (!/^\d+$/.test(uriFileNameWithoutExt)) {
          fileName = decodedFileName;
        } else {
          fileName = `photo-${timestamp}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
        }
      } else {
        fileName = `photo-${timestamp}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
      }
    }

    return fileName;
  }, []);

  const uploadAsset = React.useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      if (!userId) return;

      const timestamp = Date.now();
      const fileName = generateFileName(asset);
      const fileType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
      const storageRef = ref(storage, `uploads/${userId}/${timestamp}_${fileName}`);
      const attachmentId = `upload-${timestamp}`;

      // Generate thumbnail for videos
      let thumbnailUri: string | undefined;
      if (asset.type === 'video') {
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(asset.uri, {
            time: 0,
          });
          thumbnailUri = uri;
        } catch (error) {
          uploadLog.warn('thumbnail.failed');
        }
      }

      setFileAttachment({
        id: attachmentId,
        uri: asset.uri,
        progress: 0,
        downloadURL: null,
        error: null,
        storagePath: storageRef.fullPath,
        fileName,
        fileType,
        fileSize: asset.fileSize || 0,
        width: asset.width,
        height: asset.height,
        thumbnailUri,
      });

      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();

        const uploadTask = uploadBytesResumable(storageRef, blob);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setFileAttachment((prev: FileAttachment | null) =>
              prev ? { ...prev, progress } : null
            );
          },
          (error) => {
            uploadLog.error('file.upload.failed', undefined, error);
            setFileAttachment((prev: FileAttachment | null) =>
              prev ? { ...prev, error: 'Upload failed. Please try again.' } : null
            );
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setFileAttachment((prev: FileAttachment | null) =>
                prev ? { ...prev, progress: 100, downloadURL } : null
              );
            } catch (error) {
              uploadLog.error('file.downloadUrl.failed', undefined, error);
              setFileAttachment((prev: FileAttachment | null) =>
                prev ? { ...prev, error: 'Failed to process file.' } : null
              );
            }
          }
        );
      } catch (error) {
        uploadLog.error('file.upload.failed', undefined, error);
        setFileAttachment((prev: FileAttachment | null) =>
          prev ? { ...prev, error: 'Failed to upload file.' } : null
        );
      }
    },
    [userId, storage, generateFileName]
  );

  const uploadDocument = React.useCallback(
    async (file: DocumentPicker.DocumentPickerAsset) => {
      if (!userId) return;

      const timestamp = Date.now();
      const fileName = file.name;
      const fileType = file.mimeType || 'application/octet-stream';
      const storageRef = ref(storage, `uploads/${userId}/${timestamp}_${fileName}`);
      const attachmentId = `upload-${timestamp}`;

      setFileAttachment({
        id: attachmentId,
        uri: file.uri,
        progress: 0,
        downloadURL: null,
        error: null,
        storagePath: storageRef.fullPath,
        fileName,
        fileType,
        fileSize: file.size || 0,
        width: 0,
        height: 0,
      });

      try {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const uploadTask = uploadBytesResumable(storageRef, blob);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setFileAttachment((prev: FileAttachment | null) =>
              prev ? { ...prev, progress } : null
            );
          },
          (error) => {
            uploadLog.error('file.upload.failed', undefined, error);
            setFileAttachment((prev: FileAttachment | null) =>
              prev ? { ...prev, error: 'Upload failed' } : null
            );
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setFileAttachment((prev: FileAttachment | null) =>
              prev
                ? {
                    ...prev,
                    downloadURL,
                    progress: 100,
                  }
                : null
            );
          }
        );
      } catch (error) {
        uploadLog.error('file.upload.failed', undefined, error);
        setFileAttachment((prev: FileAttachment | null) =>
          prev ? { ...prev, error: 'Upload failed' } : null
        );
      }
    },
    [userId, storage]
  );

  const removeAttachment = React.useCallback(() => {
    setFileAttachment(null);
  }, []);

  return {
    fileAttachment,
    uploadAsset,
    uploadDocument,
    removeAttachment,
    setFileAttachment,
  };
}
