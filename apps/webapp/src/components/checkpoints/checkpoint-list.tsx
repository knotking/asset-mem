'use client';

import { useState } from 'react';
import { CheckpointCard } from './checkpoint-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, ArrowRightLeft, X, Trash2, Loader2 } from 'lucide-react';
import { CHECKPOINT_PAGE_SIZE } from '@/contexts/checkpoint-context';
import { Checkpoint } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { useAuth } from '@/contexts/auth-context';
import { useProperty } from '@/contexts/property-context';
import { useToast } from '@/hooks/use-toast';
import { deleteCheckpointsBatch } from '@/lib/deletion/delete-checkpoint';
import {
  checkpointBulkDeleteFailed,
  deletionRetryLabel,
  isResourceDeletionFailed,
  markResourcesDeletionFailed,
} from '@/lib/deletion';
import { db } from '@/lib/firebase';
import { doc } from 'firebase/firestore';
import { getWebDeletionApiUrls } from '@/lib/api-deletion';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import { createLogger } from '@/lib/logger';
import { FeatureTipBanner } from '@/components/feature-discovery/feature-tip-banner';
import { usePreferences } from '@/contexts/preferences-context';
import { useDismissFeatureTip } from '@/hooks/use-dismiss-feature-tip';
import { shouldShowFeatureTip } from '@/lib/feature-discovery';

const checkpointLog = createLogger('checkpoint');

interface CheckpointListProps {
  checkpoints: Checkpoint[];
  loading: boolean;
  onCheckpointClick: (checkpoint: Checkpoint) => void;
  onCompare?: (checkpoint1: Checkpoint, checkpoint2: Checkpoint) => void;
}

export function CheckpointList({
  checkpoints,
  loading,
  onCheckpointClick,
  onCompare,
}: CheckpointListProps) {
  const { user } = useAuth();
  const { property } = useProperty();
  const {
    loadMoreCheckpoints,
    hasMoreCheckpoints,
    isLoadingEarlier,
    deleteCheckpoint,
    markCheckpointsDeleting,
    clearCheckpointsDeleting,
    isCheckpointDeletingOverlay,
  } = useCheckpoint();
  const { toast } = useToast();
  const { preferences } = usePreferences();
  const { dismissTip } = useDismissFeatureTip();
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Extract unique locations
  const locations = Array.from(
    new Set(checkpoints.map((cp) => cp.location).filter(Boolean))
  ).sort();

  // Filter checkpoints
  const filteredCheckpoints = checkpoints.filter((cp) => {
    const matchesSearch =
      !searchTerm ||
      cp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cp.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cp.location?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLocation = locationFilter === 'all' || cp.location === locationFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'analyzed' && cp.aiAnalysis) ||
      (statusFilter === 'pending' && !cp.aiAnalysis) ||
      (statusFilter === 'issues' && cp.aiAnalysis?.issues && cp.aiAnalysis.issues.length > 0);

    return matchesSearch && matchesLocation && matchesStatus;
  });

  const handleSelect = (checkpointId: string, selected: boolean) => {
    const newSelection = new Set(selectedCheckpoints);
    if (selected) {
      newSelection.add(checkpointId);
    } else {
      newSelection.delete(checkpointId);
    }
    setSelectedCheckpoints(newSelection);
  };

  const handleCompare = () => {
    if (selectedCheckpoints.size === 2 && onCompare) {
      const [id1, id2] = Array.from(selectedCheckpoints);
      const cp1 = checkpoints.find((cp) => cp.id === id1);
      const cp2 = checkpoints.find((cp) => cp.id === id2);
      if (cp1 && cp2) {
        onCompare(cp1, cp2);
        setSelectionMode(false);
        setSelectedCheckpoints(new Set());
      }
    }
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedCheckpoints(new Set());
  };

  const handleDeleteClick = () => {
    if (selectedCheckpoints.size > 0) {
      setIsDeleteDialogOpen(true);
    }
  };

  const runBulkDelete = async (checkpointIds: string[]) => {
    const count = checkpointIds.length;
    try {
      if (!user || !property) {
        throw new Error('User or property not found');
      }
      const deletionUrls = getWebDeletionApiUrls();
      const result = await deleteCheckpointsBatch({
        userId: user.uid,
        propertyId: property.id,
        checkpointIds,
        checkpointsBatchUrl: deletionUrls.checkpointsBatch,
        getIdToken: getFirebaseIdTokenForProxy,
      });
      if (!result.ok) {
        throw new Error(result.failed[0]?.message ?? checkpointBulkDeleteFailed);
      }

      toast({
        title: 'Checkpoints Deleted',
        description: `${count} checkpoint${count === 1 ? '' : 's'} deleted successfully.`,
      });
    } catch (error) {
      checkpointLog.error('checkpoints.bulkDelete.failed', undefined, error);
      if (user && property) {
        const refs = checkpointIds.map((id) =>
          doc(db, 'users', user.uid, 'properties', property.id, 'checkpoints', id)
        );
        await markResourcesDeletionFailed(db, refs, error);
      }
      toast({
        title: 'Deletion Failed',
        description: checkpointBulkDeleteFailed,
        variant: 'destructive',
      });
    } finally {
      clearCheckpointsDeleting(checkpointIds);
    }
  };

  const handleRetryDeleteCheckpoint = (checkpoint: Checkpoint) => {
    void deleteCheckpoint(checkpoint.id).catch((error) => {
      checkpointLog.error('checkpoint.retryDelete.failed', undefined, error);
      toast({
        title: 'Deletion Failed',
        description: checkpointBulkDeleteFailed,
        variant: 'destructive',
      });
    });
  };

  const handleConfirmDelete = (event: React.MouseEvent) => {
    event.preventDefault();
    if (selectedCheckpoints.size === 0) return;

    const checkpointIds = Array.from(selectedCheckpoints);
    setIsDeleteDialogOpen(false);
    setSelectedCheckpoints(new Set());
    setSelectionMode(false);
    markCheckpointsDeleting(checkpointIds);
    void runBulkDelete(checkpointIds);
  };

  if (loading) {
    return <CheckpointListSkeleton />;
  }

  if (checkpoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-muted p-6">
          <Search className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-base sm:text-lg font-semibold">No Checkpoints Yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Capture photos or videos of rooms, systems, or problem areas. AI scores condition over
          time — then attach checkpoints to chat for analysis and cost estimates.
        </p>
      </div>
    );
  }

  const showCompareTip =
    checkpoints.length >= 2 &&
    shouldShowFeatureTip(preferences, 'checkpoints_compare') &&
    !selectionMode;

  const isTrulyEmpty =
    checkpoints.length === 0 &&
    !searchTerm &&
    locationFilter === 'all' &&
    statusFilter === 'all';

  return (
    <div className="space-y-4">
      {showCompareTip ? (
        <FeatureTipBanner
          tipId="checkpoints_compare"
          title="Compare before and after"
          description="Tap Compare, select two checkpoints, and review AI-detected changes — great for tracking repairs or deterioration."
          onDismiss={dismissTip}
          actionLabel="Start compare mode"
          onAction={() => setSelectionMode(true)}
        />
      ) : null}
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search checkpoints..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location} value={location!}>
                {location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="analyzed">Analyzed</SelectItem>
            <SelectItem value="pending">Pending Analysis</SelectItem>
            <SelectItem value="issues">Has Issues</SelectItem>
          </SelectContent>
        </Select>

        {onCompare && !selectionMode && (
          <Button variant="outline" onClick={() => setSelectionMode(true)}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Compare
          </Button>
        )}
      </div>

      {/* Selection Mode Banner */}
      {selectionMode && (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {selectedCheckpoints.size} selected
            </Badge>
            <span className="min-w-0 text-sm text-muted-foreground">
              {selectedCheckpoints.size === 2
                ? 'Select 2 checkpoints to compare'
                : 'Select checkpoints to delete or compare'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleCompare}
              disabled={selectedCheckpoints.size !== 2}
              className="flex-1 sm:flex-none"
            >
              Compare Selected
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteClick}
              disabled={selectedCheckpoints.size === 0}
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancelSelection} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCheckpoints.size} checkpoint{selectedCheckpoints.size === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected checkpoint{selectedCheckpoints.size === 1 ? '' : 's'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={selectedCheckpoints.size === 0}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Checkpoints List */}
      {filteredCheckpoints.length === 0 ? (
        <div className="py-12 text-center">
          {isTrulyEmpty ? (
            <>
              <p className="font-medium text-foreground">No checkpoints yet</p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Capture photos or videos of rooms, systems, or problem areas. AI scores condition
                over time — then attach checkpoints to chat for analysis and cost estimates.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">No checkpoints match your filters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCheckpoints.map((checkpoint) => (
            <CheckpointCard
              key={checkpoint.id}
              checkpoint={checkpoint}
              selected={selectedCheckpoints.has(checkpoint.id)}
              selectionMode={selectionMode}
              isDeleting={isCheckpointDeletingOverlay(checkpoint)}
              isDeleteFailed={isResourceDeletionFailed(checkpoint)}
              onRetryDelete={() => handleRetryDeleteCheckpoint(checkpoint)}
              onClick={() => !selectionMode && onCheckpointClick(checkpoint)}
              onSelect={(selected) => handleSelect(checkpoint.id, selected)}
            />
          ))}
          {!selectionMode && hasMoreCheckpoints && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => void loadMoreCheckpoints()}
                disabled={isLoadingEarlier}
              >
                {isLoadingEarlier && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Load more checkpoints
              </Button>
            </div>
          )}
          {!selectionMode &&
            !hasMoreCheckpoints &&
            checkpoints.length > CHECKPOINT_PAGE_SIZE && (
              <p className="pt-4 text-center text-sm text-muted-foreground">
                No more checkpoints to load
              </p>
            )}
        </div>
      )}
    </div>
  );
}

function CheckpointListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-full sm:w-[180px]" />
        <Skeleton className="h-10 w-full sm:w-[180px]" />
        <Skeleton className="h-10 w-[120px]" />
      </div>

      {/* List Skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Skeleton key={idx} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}

