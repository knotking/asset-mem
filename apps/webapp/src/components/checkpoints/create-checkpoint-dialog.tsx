'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { analyzeCheckpoint } from '@/lib/api';

interface FileWithPreview {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface CreateCheckpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCheckpointDialog({ open, onOpenChange }: CreateCheckpointDialogProps) {
  const { createCheckpoint } = useCheckpoint();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: FileWithPreview[] = [];
    Array.from(selectedFiles).forEach((file) => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const preview = URL.createObjectURL(file);
        const type = file.type.startsWith('image/') ? 'image' : 'video';
        newFiles.push({ file, preview, type });
      }
    });

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select at least one image or video',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      // Convert File objects to data URLs for the checkpoint context
      const mediaFiles = await Promise.all(
        files.map(async ({ file, type }) => {
          return new Promise<{ uri: string; type: 'image' | 'video' }>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                uri: reader.result as string,
                type,
              });
            };
            reader.readAsDataURL(file);
          });
        })
      );

      const result = await createCheckpoint(
        {
          name: name || undefined,
          location: location || undefined,
          description: description || undefined,
        },
        mediaFiles
      );

      // Trigger AI analysis
      if (result.id && result.media.length > 0) {
        try {
          await analyzeCheckpoint({
            checkpointId: result.id,
            mediaGsURI: result.media[0].gsURI,
          });
        } catch (analysisError) {
          console.error('Failed to trigger analysis:', analysisError);
          // Don't fail the checkpoint creation if analysis fails
        }
      }

      toast({
        title: 'Checkpoint created',
        description: 'Your checkpoint has been created and is being analyzed by AI.',
      });

      // Reset form
      setName('');
      setLocation('');
      setDescription('');
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setFiles([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating checkpoint:', error);
      toast({
        title: 'Error creating checkpoint',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Checkpoint</DialogTitle>
          <DialogDescription>
            Document your property condition with photos or videos. AI will analyze them automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload Zone */}
          <div className="space-y-2">
            <Label>Media</Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">
                Drag & drop files here, or click to select
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Supports images and videos (JPG, PNG, MP4, etc.)
              </p>
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/*,video/*"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                Select Files
              </Button>
            </div>

            {/* File Previews */}
            {files.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                {files.map((file, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                      {file.type === 'image' ? (
                        <img
                          src={file.preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          <span className="absolute bottom-2 left-2 right-2 text-xs bg-black/70 text-white px-2 py-1 rounded">
                            Video
                          </span>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name (Optional)</Label>
            <Input
              id="name"
              placeholder="e.g., Monthly Inspection - January 2025"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to auto-generate based on location and date
            </p>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location (Optional)</Label>
            <Input
              id="location"
              placeholder="e.g., Kitchen, Living Room, Exterior"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              AI will attempt to detect location if not provided
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add any notes about this checkpoint..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || files.length === 0}>
              {isCreating ? 'Creating...' : 'Create Checkpoint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

