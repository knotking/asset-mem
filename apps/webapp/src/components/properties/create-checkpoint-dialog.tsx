'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, X, Camera } from 'lucide-react';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { useAuth } from '@/contexts/auth-context';
import { useProperty } from '@/contexts/property-context';
import { useToast } from '@/hooks/use-toast';
import { analyzeCheckpoint } from '@/lib/checkpoint-api';
import Image from 'next/image';
import { format } from 'date-fns';

interface CreateCheckpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LOCATIONS = [
  { label: 'Kitchen', value: 'Kitchen' },
  { label: 'Bathroom', value: 'Bathroom' },
  { label: 'Living Room', value: 'Living Room' },
  { label: 'Bedroom', value: 'Bedroom' },
  { label: 'Exterior', value: 'Exterior' },
  { label: 'Basement', value: 'Basement' },
  { label: 'Attic', value: 'Attic' },
  { label: 'Garage', value: 'Garage' },
  { label: 'Other', value: 'Other' },
];

export function CreateCheckpointDialog({ open, onOpenChange }: CreateCheckpointDialogProps) {
  const { createCheckpoint, updateCheckpoint } = useCheckpoint();
  const { user } = useAuth();
  const { property } = useProperty();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(
        file => file.type.startsWith('image/') || file.type.startsWith('video/')
      );
      
      if (newFiles.length > 0) {
        setFiles(newFiles);
        
        // Create preview URLs
        const urls = newFiles.map(file => URL.createObjectURL(file));
        setPreviewUrls(urls);
      }
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(newFiles);
      
      // Create preview URLs
      const urls = newFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(urls);
    }
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => {
      const newUrls = prev.filter((_, i) => i !== index);
      // Revoke the removed URL to free memory
      URL.revokeObjectURL(prev[index]);
      return newUrls;
    });
  }, []);

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast({
        title: "No media selected",
        description: "Please upload at least one photo or video.",
        variant: "destructive",
      });
      return;
    }

    if (!user || !property) {
      toast({
        title: "Error",
        description: "User or property not found.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Auto-generate name if not provided
      const finalName = name.trim() || `${(location || 'Checkpoint').trim()} • ${format(new Date(), 'MMM d')}`;
      
      const result = await createCheckpoint(
        {
          name: finalName,
          location: location.trim(),
        },
        files
      );

      // Set status to pending initially
      await updateCheckpoint(result.id, {
        analysisStatus: 'pending',
      });

      // Trigger AI Analysis via Pub/Sub (async)
      const firstMedia = result.media[0];
      if (firstMedia?.gsURI) {
        updateCheckpoint(result.id, {
          analysisStatus: 'processing',
        }).catch(err => console.error('Error updating status:', err));

        // Fire and forget - worker will update Firestore
        analyzeCheckpoint({
          imageUrl: firstMedia.gsURI,
          contentType: firstMedia.contentType,
          location: location.trim(),
          checkpointId: result.id,
          userId: user.uid,
          propertyId: property.id,
        }).catch(err => {
          console.error('Error publishing checkpoint analysis:', err);
          updateCheckpoint(result.id, {
            analysisStatus: 'failed',
          }).catch(updateErr => console.error('Error updating status to failed:', updateErr));
        });
      } else {
        await updateCheckpoint(result.id, {
          analysisStatus: 'completed',
        });
      }

      toast({
        title: "Checkpoint created",
        description: "Your checkpoint is being analyzed...",
      });

      // Clean up preview URLs
      previewUrls.forEach(url => URL.revokeObjectURL(url));

      // Reset form
      setName('');
      setLocation('');
      setFiles([]);
      setPreviewUrls([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating checkpoint:', error);
      toast({
        title: "Error",
        description: "Failed to create checkpoint. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Clean up preview URLs when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setName('');
      setLocation('');
      setFiles([]);
      setPreviewUrls([]);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Checkpoint</DialogTitle>
          <DialogDescription>
            Upload photos or videos to document your property&apos;s condition.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Upload Area */}
          <div>
            <Label>Media (Photos or Videos)</Label>
            <div
              className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {files.length === 0 ? (
                <div>
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop files here, or click to select
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Supports: JPG, PNG, MP4 (max 50MB)
                  </p>
                  <Button variant="secondary" onClick={() => document.getElementById('file-input')?.click()}>
                    <Camera className="h-4 w-4 mr-2" />
                    Select Files
                  </Button>
                  <input
                    id="file-input"
                    type="file"
                    className="hidden"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileInput}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {files.map((file, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                          {file.type.startsWith('image/') ? (
                            <Image
                              src={previewUrls[index]}
                              alt={file.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <video src={previewUrls[index]} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{file.name}</p>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    Add More Files
                  </Button>
                  <input
                    id="file-input"
                    type="file"
                    className="hidden"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileInput}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Name Field */}
          <div>
            <Label htmlFor="name">Checkpoint Name</Label>
            <Input
              id="name"
              placeholder="e.g., Kitchen Sink Leak"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank to auto-generate based on location and date.
            </p>
          </div>

          {/* Location Field */}
          <div>
            <Label>Location</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {LOCATIONS.map((loc) => {
                const isSelected = location === loc.value;
                return (
                  <Badge
                    key={loc.value}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setLocation(isSelected ? '' : loc.value)}
                  >
                    {loc.label}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Optional — we&apos;ll auto-detect this from the photo when possible.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={files.length === 0 || loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Checkpoint'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

