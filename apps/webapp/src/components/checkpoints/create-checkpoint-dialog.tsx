'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUploadZone } from './file-upload-zone';
import { CheckpointProcessingDialog } from './checkpoint-processing-dialog';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { useToast } from '@/hooks/use-toast';
import { analyzeCheckpoint } from '@/lib/api-checkpoint';
import { Loader2 } from 'lucide-react';

interface CreateCheckpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FileWithPreview {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

export function CreateCheckpointDialog({
  open,
  onOpenChange,
}: CreateCheckpointDialogProps) {
  const { createCheckpoint, setSelectedCheckpoint, checkpoints } = useCheckpoint();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Processing feedback state
  const [isProcessingDialogOpen, setIsProcessingDialogOpen] = useState(false);
  const [newCheckpointId, setNewCheckpointId] = useState('');
  const [newCheckpointName, setNewCheckpointName] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please provide a name for the checkpoint.',
        variant: 'destructive',
      });
      return;
    }

    if (files.length === 0) {
      toast({
        title: 'Media Required',
        description: 'Please upload at least one photo or video.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      // Convert File objects to the format expected by the context
      const mediaFiles = await Promise.all(
        files.map(async (fileWithPreview) => {
          // Read file as data URL for React Native compatibility
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(fileWithPreview.file);
          });

          return {
            uri: dataUrl,
            type: fileWithPreview.type,
          };
        })
      );

      const result = await createCheckpoint(
        {
          name: name.trim(),
          location: location.trim() || undefined,
          description: description.trim() || undefined,
        },
        mediaFiles
      );

      // Close create dialog and show processing feedback dialog
      setNewCheckpointId(result.id);
      setNewCheckpointName(name.trim());
      onOpenChange(false);
      setIsProcessingDialogOpen(true);

      // Trigger AI analysis
      if (result.id && result.media.length > 0) {
        try {
          await analyzeCheckpoint(result.id, result.media[0].gsURI);
        } catch (error) {
          console.error('Failed to trigger analysis:', error);
          // Don't show error to user - analysis will happen eventually
        }
      }

      // Reset form
      setName('');
      setLocation('');
      setDescription('');
      setFiles([]);
    } catch (error) {
      console.error('Failed to create checkpoint:', error);
      toast({
        title: 'Creation Failed',
        description: 'Failed to create checkpoint. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    if (!isCreating) {
      setName('');
      setLocation('');
      setDescription('');
      setFiles([]);
      onOpenChange(false);
    }
  };

  const handleViewNewCheckpoint = (checkpointId: string) => {
    // Find the checkpoint and open detail view
    const checkpoint = checkpoints.find(cp => cp.id === checkpointId);
    if (checkpoint) {
      setSelectedCheckpoint(checkpoint);
    }
    setIsProcessingDialogOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Checkpoint</DialogTitle>
          <DialogDescription>
            Capture the current state of your property with photos or videos. AI will automatically
            analyze the condition and detect any issues.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Monthly Kitchen Inspection"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g., Kitchen, Bathroom, Exterior"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to auto-detect location from photos
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add any notes about this checkpoint..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              rows={3}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>
              Photos/Videos <span className="text-destructive">*</span>
            </Label>
            <FileUploadZone onFilesChange={setFiles} maxFiles={10} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCreating ? 'Creating...' : 'Create Checkpoint'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <CheckpointProcessingDialog
        open={isProcessingDialogOpen}
        onOpenChange={setIsProcessingDialogOpen}
        checkpointId={newCheckpointId}
        checkpointName={newCheckpointName}
        onViewCheckpoint={handleViewNewCheckpoint}
      />
    </Dialog>
  );
}

