'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CheckpointList } from '@/components/checkpoints/checkpoint-list';
import { CreateCheckpointDialog } from '@/components/checkpoints/create-checkpoint-dialog';
import { CheckpointDetailDialog } from '@/components/checkpoints/checkpoint-detail-dialog';
import { CheckpointComparisonDialog } from '@/components/checkpoints/checkpoint-comparison-dialog';
import { MetricsDashboard } from '@/components/checkpoints/metrics-dashboard';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { Checkpoint } from '@homeapp/common/types';

export default function PropertyCheckpointsPage() {
  const { checkpoints, loading, setSelectedCheckpoint } = useCheckpoint();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [comparisonCheckpoints, setComparisonCheckpoints] = useState<
    [Checkpoint, Checkpoint] | null
  >(null);

  const handleCheckpointClick = (checkpoint: Checkpoint) => {
    setSelectedCheckpoint(checkpoint);
  };

  const handleCompare = (checkpoint1: Checkpoint, checkpoint2: Checkpoint) => {
    setComparisonCheckpoints([checkpoint1, checkpoint2]);
    setIsComparisonOpen(true);
  };

  // Stats for footer
  const totalCheckpoints = checkpoints.length;
  const totalPhotos = checkpoints.reduce((sum, cp) => sum + cp.media.length, 0);
  const uniqueLocations = new Set(checkpoints.map((cp) => cp.location).filter(Boolean)).size;
  const goodCondition = checkpoints.filter(
    (cp) =>
      cp.aiAnalysis && (!cp.aiAnalysis.issues || cp.aiAnalysis.issues.length === 0)
  ).length;
  const needsAttention = checkpoints.filter(
    (cp) => cp.aiAnalysis && cp.aiAnalysis.issues && cp.aiAnalysis.issues.length > 0
  ).length;

    return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
                    <header className="mb-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">Property Timeline</h1>
                <p className="text-muted-foreground">
                  Visual history of property condition with photos and AI analysis
                </p>
                            </div>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                                Add Checkpoint
                            </Button>
                        </div>
                    </header>

          {/* Metrics Dashboard */}
          <MetricsDashboard />

          {/* Checkpoint List */}
          <CheckpointList
            checkpoints={checkpoints}
            loading={loading}
            onCheckpointClick={handleCheckpointClick}
            onCompare={handleCompare}
                            />
                        </div>
                    </div>

      {/* Stats Footer */}
      <footer className="sticky bottom-0 border-t bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl p-4">
          <div className="flex gap-4">
            <StatItem value={totalCheckpoints} label="Total" />
            <StatItem value={totalPhotos} label="Photos" />
            <StatItem value={uniqueLocations} label="Locations" />
            <StatItem value={goodCondition} label="Good" />
            <StatItem value={needsAttention} label="Needs Attention" />
                </div>
                </div>
            </footer>

      {/* Dialogs */}
      <CreateCheckpointDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      <CheckpointDetailDialog />
      {isComparisonOpen && comparisonCheckpoints && (
        <CheckpointComparisonDialog
          open={isComparisonOpen}
          onOpenChange={setIsComparisonOpen}
          checkpoint1={comparisonCheckpoints[0]}
          checkpoint2={comparisonCheckpoints[1]}
        />
      )}
        </div>
    );
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-lg border bg-card px-4 py-3 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
