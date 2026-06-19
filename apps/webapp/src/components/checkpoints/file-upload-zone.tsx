'use client';

import { useCallback, useState } from 'react';
import { Upload, X, Image as ImageIcon, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export interface FileWithPreview {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

export function fileToPreview(file: File): FileWithPreview {
  return {
    file,
    preview: URL.createObjectURL(file),
    type: file.type.startsWith('video/') ? 'video' : 'image',
  };
}

export function revokeFilePreviews(files: FileWithPreview[]) {
  for (const entry of files) {
    URL.revokeObjectURL(entry.preview);
  }
}

interface FileUploadZoneProps {
  files: FileWithPreview[];
  onFilesChange: (files: FileWithPreview[]) => void;
  maxFiles?: number;
  accept?: string;
}

export function FileUploadZone({
  files,
  onFilesChange,
  maxFiles = 10,
  accept = 'image/*,video/*',
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;

      const fileArray = Array.from(newFiles).slice(0, maxFiles - files.length);
      const filesWithPreviews = fileArray.map(fileToPreview);
      onFilesChange([...files, ...filesWithPreviews]);
    },
    [files, maxFiles, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files);
      e.target.value = '';
    },
    [processFiles]
  );

  const removeFile = useCallback(
    (index: number) => {
      URL.revokeObjectURL(files[index].preview);
      onFilesChange(files.filter((_, i) => i !== index));
    },
    [files, onFilesChange]
  );

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <input
          type="file"
          multiple
          accept={accept}
          onChange={handleFileInput}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={files.length >= maxFiles}
        />

        <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">
          Drop files here or click to browse
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Images and videos ({files.length}/{maxFiles})
        </p>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {files.map((fileWithPreview, index) => (
            <div
              key={fileWithPreview.preview}
              className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
            >
              {fileWithPreview.type === 'image' ? (
                <Image
                  src={fileWithPreview.preview}
                  alt={`Upload ${index + 1}`}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Film className="h-12 w-12 text-muted-foreground" />
                </div>
              )}

              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute right-1 top-1 h-6 w-6 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                {fileWithPreview.type === 'image' ? (
                  <ImageIcon className="inline h-3 w-3" />
                ) : (
                  <Film className="inline h-3 w-3" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
