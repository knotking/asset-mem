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
import { Loader2, Camera, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';

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

type CheckpointSourceType = 'media' | 'inspection_report';

const REPORT_TYPES = {
  real_estate: [
    { label: 'Home Inspection', value: 'home_inspection' as const },
    { label: 'Contractor Assessment', value: 'contractor_assessment' as const },
    { label: 'Other', value: 'other' as const },
  ],
  vehicle: [
    { label: 'Vehicle Inspection', value: 'vehicle_inspection' as const },
    { label: 'Other', value: 'other' as const },
  ],
  appliance: [
    { label: 'Appliance Maintenance', value: 'appliance_maintenance' as const },
    { label: 'Other', value: 'other' as const },
  ],
  other: [
    { label: 'Other', value: 'other' as const },
  ],
};

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
  const { createCheckpoint, setSelectedCheckpoint, checkpoints } = useCheckpoint();
  const { user } = useAuth();
  const { property } = useProperty();
  const { toast } = useToast();

  const [sourceType, setSourceType] = useState<CheckpointSourceType>('media');
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<'real_estate' | 'vehicle' | 'appliance' | 'other'>('real_estate');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportType, setReportType] = useState<'home_inspection' | 'vehicle_inspection' | 'appliance_maintenance' | 'contractor_assessment' | 'other'>('home_inspection');
  const [inspectorName, setInspectorName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Processing feedback state
  const [isProcessingDialogOpen, setIsProcessingDialogOpen] = useState(false);
  const [newCheckpointId, setNewCheckpointId] = useState('');
  const [newCheckpointName, setNewCheckpointName] = useState('');

  const handleCreateInspectionReport = async () => {
    if (!name.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please provide a name for the checkpoint.',
        variant: 'destructive',
      });
      return;
    }

    if (!reportFile) {
      toast({
        title: 'Report Required',
        description: 'Please upload an inspection report document.',
        variant: 'destructive',
      });
      return;
    }

    if (!user || !property) {
      toast({
        title: 'Error',
        description: 'User or property information not available.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      const storage = getStorage();
      const timestamp = Date.now();
      const fileName = reportFile.name || `inspection_report_${timestamp}`;
      const storagePath = `checkpoints/${user.uid}/${property.id}/${timestamp}_${fileName}`;
      const storageRef = ref(storage, storagePath);

      // Upload to Firebase Storage
      const uploadTask = uploadBytesResumable(storageRef, reportFile, {
        contentType: reportFile.type || 'application/pdf',
      });

      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', null, reject, () => resolve());
      });

      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
      const gsURI = `gs://${uploadTask.snapshot.ref.bucket}/${uploadTask.snapshot.ref.fullPath}`;

      // Create checkpoint with inspection report
      const checkpointData: any = {
        userId: user.uid,
        propertyId: property.id,
        name: name.trim(),
        assetType,
        location: location.trim() || 'Whole Property',
        sourceType: 'inspection_report',
        media: [],
        inspectionReport: {
          documentType: reportType,
          inspectorName: inspectorName.trim() || undefined,
          reportUrl: downloadURL,
          reportGsURI: gsURI,
          fileName: fileName,
          fileSize: reportFile.size,
          contentType: reportFile.type || 'application/pdf',
        },
        createdAt: Timestamp.now(),
        analysisStatus: 'pending',
      };

      const result = await createCheckpoint(checkpointData, []);

      // Close create dialog and show processing feedback dialog
      setNewCheckpointId(result.id);
      setNewCheckpointName(name.trim());
      onOpenChange(false);
      setIsProcessingDialogOpen(true);

      // Trigger AI analysis for inspection report
      try {
        await analyzeCheckpoint({
          imageUrl: gsURI,
          contentType: reportFile.type || 'application/pdf',
          assetType,
          location: location.trim() || undefined,
          checkpointId: result.id,
          userId: user.uid,
          propertyId: property.id,
        });
      } catch (error) {
        console.error('Failed to trigger analysis:', error);
      }

      // Reset form
      setName('');
      setAssetType('real_estate');
      setLocation('');
      setDescription('');
      setReportFile(null);
      setInspectorName('');
    } catch (error) {
      console.error('Failed to create inspection report checkpoint:', error);
      toast({
        title: 'Creation Failed',
        description: 'Failed to create inspection report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreate = async () => {
    if (sourceType === 'inspection_report') {
      return handleCreateInspectionReport();
    }

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
          assetType,
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
          console.error('Failed to trigger analysis:', error);
          // Don't show error to user - analysis will happen eventually
        }
      }

      // Reset form
      setName('');
      setAssetType('real_estate');
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
      setSourceType('media');
      setName('');
      setAssetType('real_estate');
      setLocation('');
      setDescription('');
      setFiles([]);
      setReportFile(null);
      setInspectorName('');
      onOpenChange(false);
    }
  };

  const handleReportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReportFile(file);
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
            {sourceType === 'media'
              ? 'Capture the current state of your property with photos or videos. AI will automatically analyze the condition and detect any issues.'
              : 'Upload an inspection report document. AI will extract findings, issues, and recommendations.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Type Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setSourceType('media')}
              disabled={isCreating}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors',
                sourceType === 'media'
                  ? 'bg-background shadow-sm'
                  : 'hover:bg-background/50'
              )}
            >
              <Camera className="h-4 w-4" />
              <span className="text-sm font-medium">Photo/Video</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceType('inspection_report')}
              disabled={isCreating}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors',
                sourceType === 'inspection_report'
                  ? 'bg-background shadow-sm'
                  : 'hover:bg-background/50'
              )}
            >
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">Inspection Report</span>
            </button>
          </div>
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

          {/* Conditional Fields Based on Source Type */}
          {sourceType === 'media' ? (
            <>
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
            </>
          ) : (
            <>
              {/* Report Type */}
              <div className="space-y-2">
                <Label htmlFor="report-type">Report Type</Label>
                <Select
                  value={reportType}
                  onValueChange={(value: any) => setReportType(value)}
                  disabled={isCreating}
                >
                  <SelectTrigger id="report-type">
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES[assetType].map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Inspector Name */}
              <div className="space-y-2">
                <Label htmlFor="inspector">Inspector Name (Optional)</Label>
                <Input
                  id="inspector"
                  placeholder="e.g., John Smith, ABC Inspections"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  disabled={isCreating}
                />
                <p className="text-xs text-muted-foreground">
                  AI will attempt to extract inspector info from the report if not provided
                </p>
              </div>

              {/* Report File Upload */}
              <div className="space-y-2">
                <Label htmlFor="report-file">
                  Report Document <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="report-file"
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    onChange={handleReportFileChange}
                    disabled={isCreating}
                    className="cursor-pointer"
                  />
                </div>
                {reportFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{reportFile.name}</span>
                    <span>({(reportFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Supported: PDF, images (JPG, PNG), Word documents
                </p>
              </div>
            </>
          )}
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
        onContinue={handleContinue}
      />
    </Dialog>
  );
}

