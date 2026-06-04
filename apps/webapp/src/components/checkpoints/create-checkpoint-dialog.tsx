'use client';

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileUploadZone } from './file-upload-zone';
import { CheckpointProcessingDialog } from './checkpoint-processing-dialog';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { useAuth } from '@/contexts/auth-context';
import { useProperty } from '@/contexts/property-context';
import { useToast } from '@/hooks/use-toast';
import { analyzeCheckpoint } from '@/lib/api-checkpoint';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CHECKPOINT_QUOTA_USER_MESSAGE,
  getPlanLimitFailureMessage,
  isAtPlanLimit,
  planLimitBlockMessage,
  planLimitUsageHint,
} from '@/lib/plan-limit-errors';
import { useLlmTokenUsage } from '@/contexts/llm-token-usage-context';
import { createLogger } from '@/lib/logger';

const checkpointLog = createLogger('checkpoint');

interface CreateCheckpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckpointCreated?: () => void;
}

interface FileWithPreview {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

const ASSET_TYPES = [
  { label: 'Real Estate', value: 'real_estate' as const },
  { label: 'Vehicle', value: 'vehicle' as const },
  { label: 'Appliance', value: 'appliance' as const },
  { label: 'Other', value: 'other' as const },
];

const LOCATION_SUGGESTIONS = {
  real_estate: [
    // Rooms
    'Kitchen',
    'Bathroom',
    'Living Room',
    'Bedroom',
    'Dining Room',
    'Office/Study',
    'Laundry Room',
    'Garage',
    'Basement',
    'Attic',
    'Hallway',
    'Closet',
    'Mudroom',
    'Pantry',
    // Building Systems
    'HVAC System',
    'Plumbing',
    'Electrical',
    'Roof',
    'Foundation',
    'Insulation',
    'Gutters',
    // Outdoor Areas
    'Front Yard',
    'Backyard',
    'Driveway',
    'Deck',
    'Patio',
    'Pool',
    'Fence',
    'Garden',
    'Shed',
    'Exterior',
    // Specific Features
    'Windows',
    'Doors',
    'Flooring',
    'Walls',
    'Ceiling',
    'Stairs',
    'Fireplace',
    'Appliances',
    // Custom
    'Other',
  ],
  vehicle: ['Exterior', 'Interior', 'Engine Bay', 'Tires/Wheels', 'Undercarriage', 'Trunk', 'Dashboard', 'Other'],
  appliance: ['Exterior', 'Interior', 'Controls', 'Seals/Gaskets', 'Filters', 'Connections', 'Other'],
  other: ['Other'],
};

export function CreateCheckpointDialog({
  open,
  onOpenChange,
  onCheckpointCreated,
}: CreateCheckpointDialogProps) {
  const { createCheckpoint, updateCheckpoint, setSelectedCheckpoint, checkpoints } =
    useCheckpoint();
  const { user } = useAuth();
  const { property } = useProperty();
  const { toast } = useToast();
  const { checkpointsLimit, limitsLoading } = useLlmTokenUsage();
  const checkpointLimitMessage = planLimitBlockMessage(
    'checkpoint',
    checkpointsLimit,
  );
  const checkpointLimitHint = planLimitUsageHint('checkpoint', checkpointsLimit);
  const createBlockedByLimit =
    !limitsLoading && isAtPlanLimit(checkpointsLimit, 1);

  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<'real_estate' | 'vehicle' | 'appliance' | 'other'>('real_estate');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Processing feedback state
  const [isProcessingDialogOpen, setIsProcessingDialogOpen] = useState(false);
  const [newCheckpointId, setNewCheckpointId] = useState('');
  const [newCheckpointName, setNewCheckpointName] = useState('');

  // Auto-generate a friendly default name if the user hasn't typed one
  const generateDefaultName = useCallback(() => {
    const base = location.trim() || 'Checkpoint';
    return `${base} • ${format(new Date(), 'MMM d • h:mm a')}`;
  }, [location]);

  const handleCreate = async () => {
    // Name is now optional - will be AI-generated if empty
    
    if (files.length === 0) {
      toast({
        title: 'Media Required',
        description: 'Please upload at least one photo or video.',
        variant: 'destructive',
      });
      return;
    }

    if (!limitsLoading && isAtPlanLimit(checkpointsLimit, 1)) {
      toast({
        variant: 'destructive',
        title: 'Monthly checkpoint limit reached',
        description: CHECKPOINT_QUOTA_USER_MESSAGE,
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

      const checkpointData: any = {
        name: name.trim() || generateDefaultName(), // Auto-generate instead of omitting
        assetType,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      };
      
      const result = await createCheckpoint(
        checkpointData,
        mediaFiles
      );

      // Close create dialog and show processing feedback dialog
      setNewCheckpointId(result.id);
      setNewCheckpointName(name.trim() || generateDefaultName());
      onOpenChange(false);
      setIsProcessingDialogOpen(true);

      // Trigger AI analysis
      if (result.id && result.media.length > 0 && user && property) {
        try {
          const firstMedia = result.media[0];
          await analyzeCheckpoint({
            imageUrl: firstMedia.gsURI,
            contentType: firstMedia.contentType,
            location: location.trim() || undefined,
            checkpointId: result.id,
            userId: user.uid,
            propertyId: property.id,
          });
        } catch (error) {
          checkpointLog.error('checkpoint.analysis.trigger.failed', undefined, error);
          const message = getPlanLimitFailureMessage(error);
          await updateCheckpoint(result.id, {
            analysisStatus: 'failed',
            analysisFailureSummary: message,
          });
          toast({
            variant: 'destructive',
            title: 'Checkpoint analysis unavailable',
            description: message,
          });
        }
      }

      // Reset form
      setName('');
      setAssetType('real_estate');
      setLocation('');
      setDescription('');
      setFiles([]);
    } catch (error) {
      checkpointLog.error('checkpoint.create.failed', undefined, error);
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
      setAssetType('real_estate');
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

  const handleContinue = () => {
    setIsProcessingDialogOpen(false);
    // Notify parent that checkpoint was created so it can switch to select tab
    if (onCheckpointCreated) {
      onCheckpointCreated();
    }
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
              Name <span className="text-muted-foreground text-sm">(optional)</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Monthly Kitchen Inspection (leave empty for AI-generated name)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              If left empty, AI will generate a descriptive name based on the analysis
            </p>
          </div>

          {/* Asset Type */}
          <div className="space-y-2">
            <Label htmlFor="asset-type">Asset Type</Label>
            <Select
              value={assetType}
              onValueChange={(value: 'real_estate' | 'vehicle' | 'appliance' | 'other') => {
                setAssetType(value);
                setLocation(''); // Reset location when asset type changes
              }}
              disabled={isCreating}
            >
              <SelectTrigger id="asset-type">
                <SelectValue placeholder="Select asset type" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location (Optional)</Label>
            <Select
              value={location}
              onValueChange={(value) => setLocation(value)}
              disabled={isCreating}
            >
              <SelectTrigger id="location">
                <SelectValue placeholder="Select location or leave blank for auto-detect" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {LOCATION_SUGGESTIONS[assetType].map((suggestion) => (
                  <SelectItem key={suggestion} value={suggestion}>
                    {suggestion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Optional — we'll auto-detect this from the photo when possible
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
          {(checkpointLimitHint || checkpointLimitMessage) && (
            <p
              className={cn(
                'text-sm',
                checkpointLimitMessage
                  ? 'text-destructive'
                  : 'text-muted-foreground',
              )}
            >
              {checkpointLimitMessage ?? checkpointLimitHint}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || createBlockedByLimit}
          >
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
        onContinue={handleContinue}
      />
    </Dialog>
  );
}

