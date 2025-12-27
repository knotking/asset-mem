'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { CheckpointCard } from '@/components/checkpoints/checkpoint-card';
import { PropertyMetricsCard } from '@/components/checkpoints/property-metrics-card';
import { CreateCheckpointDialog } from '@/components/checkpoints/create-checkpoint-dialog';
import { CheckpointDetailDialog } from '@/components/checkpoints/checkpoint-detail-dialog';
import { CheckpointComparisonDialog } from '@/components/checkpoints/checkpoint-comparison-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

function CheckpointsPageSkeleton() {
    return (
        <div className="h-full flex flex-col">
            <div className="p-6 md:p-8 flex-1">
        <div className="max-w-6xl mx-auto">
                    <header className="mb-8">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div>
                                <Skeleton className="h-8 w-64 mb-2" />
                                <Skeleton className="h-4 w-96" />
                            </div>
                            <Skeleton className="h-10 w-40" />
                        </div>
                    </header>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-64 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </div>
            <div>
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 border-2 border-dashed rounded-lg">
      <div className="text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-muted mx-auto flex items-center justify-center">
          <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">No checkpoints yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Start documenting your property condition by creating your first checkpoint. Upload
            photos and get AI-powered analysis.
          </p>
        </div>
        <Button onClick={onCreateClick}>
          <Plus className="h-4 w-4 mr-2" />
          Create First Checkpoint
        </Button>
      </div>
    </div>
  );
}

export default function PropertyCheckpointsPage() {
  const {
    checkpoints,
    loading,
    hasMoreCheckpoints,
    isLoadingEarlier,
    loadMoreCheckpoints,
    selectedCheckpoint,
    setSelectedCheckpoint,
  } = useCheckpoint();

    const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'insights' | 'select'>('insights');
  const [selectedCheckpointIds, setSelectedCheckpointIds] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);

  // Filter checkpoints by search term
  const filteredCheckpoints = checkpoints.filter((checkpoint) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      checkpoint.name?.toLowerCase().includes(search) ||
      checkpoint.description?.toLowerCase().includes(search) ||
      checkpoint.location?.toLowerCase().includes(search)
    );
  });

  const handleCheckpointClick = (checkpointId: string) => {
    const checkpoint = checkpoints.find((c) => c.id === checkpointId);
    if (checkpoint) {
      setSelectedCheckpoint(checkpoint);
      setDetailDialogOpen(true);
    }
  };

  const handleSelectionChange = (checkpointId: string, selected: boolean) => {
    setSelectedCheckpointIds((prev) => {
      if (selected) {
        // Limit to 2 selections for comparison
        if (prev.length >= 2) {
          return [prev[1], checkpointId];
        }
        return [...prev, checkpointId];
      }
      return prev.filter((id) => id !== checkpointId);
    });
  };

  const handleCompare = () => {
    if (selectedCheckpointIds.length === 2) {
      setComparisonDialogOpen(true);
    }
  };

  const selectedCheckpointsForComparison = selectedCheckpointIds
    .map((id) => checkpoints.find((c) => c.id === id))
    .filter(Boolean) as [Checkpoint, Checkpoint] | [];

  const [beforeCheckpoint, afterCheckpoint] =
    selectedCheckpointsForComparison.length === 2
      ? selectedCheckpointsForComparison[0].createdAt < selectedCheckpointsForComparison[1].createdAt
        ? selectedCheckpointsForComparison
        : [selectedCheckpointsForComparison[1], selectedCheckpointsForComparison[0]]
      : [null, null];

  const handleClearSelection = () => {
    setSelectedCheckpointIds([]);
  };

  if (loading) {
        return <CheckpointsPageSkeleton />;
    }

    return (
        <div className="h-full flex flex-col">
      <div className="p-6 md:p-8 flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
                    <header className="mb-8">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">Property Timeline</h1>
                <p className="text-muted-foreground">
                  Visual history of property condition with AI-powered analysis
                </p>
                            </div>
              <Button onClick={() => setCreateDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Checkpoint
                            </Button>
                        </div>
                    </header>

          {checkpoints.length === 0 ? (
            <EmptyState onCreateClick={() => setCreateDialogOpen(true)} />
          ) : (
            <div>
              {/* Tabs for Insights vs Select mode */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'insights' | 'select')}>
                <div className="flex items-center justify-between mb-6">
                  <TabsList>
                    <TabsTrigger value="insights">Insights</TabsTrigger>
                    <TabsTrigger value="select">Select</TabsTrigger>
                  </TabsList>

                  {/* Search */}
                  <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search checkpoints..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                </div>

                <TabsContent value="insights" className="mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Checkpoints List */}
                    <div className="lg:col-span-2 space-y-4">
                      {filteredCheckpoints.map((checkpoint) => (
                        <CheckpointCard
                          key={checkpoint.id}
                          checkpoint={checkpoint}
                          onClick={() => handleCheckpointClick(checkpoint.id)}
                        />
                      ))}

                      {hasMoreCheckpoints && (
                        <div className="py-4">
                          <Button
                            variant="outline"
                            onClick={loadMoreCheckpoints}
                            disabled={isLoadingEarlier}
                            className="w-full"
                          >
                            {isLoadingEarlier ? 'Loading...' : 'Load More Checkpoints'}
                          </Button>
                        </div>
                      )}

                      {!hasMoreCheckpoints && checkpoints.length > 20 && (
                        <div className="py-4">
                          <p className="text-center text-sm text-muted-foreground">
                            No more checkpoints to load
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Metrics Sidebar */}
                    <div>
                      <PropertyMetricsCard />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="select" className="mt-0">
                  <div className="space-y-4">
                    {/* Selection toolbar */}
                    {selectedCheckpointIds.length > 0 && (
                      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">
                            {selectedCheckpointIds.length} selected
                          </Badge>
                          <Button
                            size="sm"
                            onClick={handleCompare}
                            disabled={selectedCheckpointIds.length !== 2}
                          >
                            Compare Selected
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleClearSelection}
                          >
                            Clear Selection
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Select exactly 2 checkpoints to compare
                        </p>
                            </div>
                        )}

                    {/* Checkpoints grid with selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredCheckpoints.map((checkpoint) => (
                        <CheckpointCard
                          key={checkpoint.id}
                          checkpoint={checkpoint}
                          selectionMode={true}
                          isSelected={selectedCheckpointIds.includes(checkpoint.id)}
                          onSelectionChange={(selected) =>
                            handleSelectionChange(checkpoint.id, selected)
                          }
                        />
                      ))}
                    </div>

                    {hasMoreCheckpoints && (
                      <div className="py-4">
                        <Button
                          variant="outline"
                          onClick={loadMoreCheckpoints}
                          disabled={isLoadingEarlier}
                          className="w-full"
                        >
                          {isLoadingEarlier ? 'Loading...' : 'Load More Checkpoints'}
                        </Button>
                      </div>
                    )}
                </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateCheckpointDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <CheckpointDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        checkpoint={selectedCheckpoint}
      />
      <CheckpointComparisonDialog
        open={comparisonDialogOpen}
        onOpenChange={setComparisonDialogOpen}
        checkpoint1={beforeCheckpoint}
        checkpoint2={afterCheckpoint}
      />
    </div>
  );
}
