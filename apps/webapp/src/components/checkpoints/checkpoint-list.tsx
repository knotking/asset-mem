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
import { Checkpoint } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { useToast } from '@/hooks/use-toast';

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
  const { deleteCheckpoint } = useCheckpoint();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleConfirmDelete = async () => {
    if (selectedCheckpoints.size === 0) return;

    const count = selectedCheckpoints.size;
    const checkpointIds = Array.from(selectedCheckpoints);
    
    setIsDeleting(true);
    try {
      const deletePromises = checkpointIds.map((id) => deleteCheckpoint(id));
      await Promise.all(deletePromises);

      toast({
        title: 'Checkpoints Deleted',
        description: `${count} checkpoint${count === 1 ? '' : 's'} deleted successfully.`,
      });

      setSelectedCheckpoints(new Set());
      setSelectionMode(false);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Failed to delete checkpoints:', error);
      toast({
        title: 'Deletion Failed',
        description: 'Failed to delete checkpoints. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
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
        <h3 className="text-lg font-semibold">No Checkpoints Yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Create your first checkpoint to start tracking your property's condition over time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
        <div className="flex items-center justify-between rounded-lg border bg-muted p-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {selectedCheckpoints.size} selected
            </Badge>
            <span className="text-sm text-muted-foreground">
              {selectedCheckpoints.size === 2
                ? 'Select 2 checkpoints to compare'
                : 'Select checkpoints to delete or compare'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCompare}
              disabled={selectedCheckpoints.size !== 2}
            >
              Compare Selected
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteClick}
              disabled={selectedCheckpoints.size === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancelSelection}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        if (!open && !isDeleting) {
          setIsDeleteDialogOpen(false);
        }
      }}>
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
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting || selectedCheckpoints.size === 0}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Checkpoints List */}
      {filteredCheckpoints.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No checkpoints match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCheckpoints.map((checkpoint) => (
            <CheckpointCard
              key={checkpoint.id}
              checkpoint={checkpoint}
              selected={selectedCheckpoints.has(checkpoint.id)}
              selectionMode={selectionMode}
              onClick={() => !selectionMode && onCheckpointClick(checkpoint)}
              onSelect={(selected) => handleSelect(checkpoint.id, selected)}
            />
          ))}
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

