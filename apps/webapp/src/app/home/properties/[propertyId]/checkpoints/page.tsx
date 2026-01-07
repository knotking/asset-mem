'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, List } from 'lucide-react';
import { CheckpointList } from '@/components/checkpoints/checkpoint-list';
import { CreateCheckpointDialog } from '@/components/checkpoints/create-checkpoint-dialog';
import { CheckpointDetailDialog } from '@/components/checkpoints/checkpoint-detail-dialog';
import { CheckpointComparisonDialog } from '@/components/checkpoints/checkpoint-comparison-dialog';
import { MetricsDashboard } from '@/components/checkpoints/metrics-dashboard';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { Checkpoint } from '@/lib/types';
import { cn } from '@/lib/utils';

type CheckpointTab = 'checkpoints' | 'insights';

export default function PropertyCheckpointsPage() {
  const { checkpoints, loading, setSelectedCheckpoint } = useCheckpoint();
  const [activeTab, setActiveTab] = useState<CheckpointTab>('checkpoints');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [comparisonCheckpoints, setComparisonCheckpoints] = useState<
    [Checkpoint, Checkpoint] | null
  >(null);

  const handleCheckpointCreated = () => {
    // Switch to checkpoints tab when a checkpoint is created
    setActiveTab('checkpoints');
  };

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
    <div className="flex h-full flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-6 md:p-8 min-h-0">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <header className="mb-6">
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

          {/* Tab Navigation */}
          <div className="mb-6 border-b">
            <nav className="flex gap-6" aria-label="Checkpoint tabs">
              <button
                onClick={() => setActiveTab('checkpoints')}
                className={cn(
                  'relative pb-3 text-sm font-medium transition-colors hover:text-foreground',
                  activeTab === 'checkpoints'
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Checkpoints
                </div>
                {activeTab === 'checkpoints' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={cn(
                  'relative pb-3 text-sm font-medium transition-colors hover:text-foreground',
                  activeTab === 'insights'
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Insights
                </div>
                {activeTab === 'insights' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'checkpoints' ? (
            <>
              {/* Checkpoints View - Full interactive list */}
              <CheckpointList
                checkpoints={checkpoints}
                loading={loading}
                onCheckpointClick={handleCheckpointClick}
                onCompare={handleCompare}
              />
            </>
          ) : (
            <>
              {/* Metrics Dashboard */}
              <MetricsDashboard />
              
              {/* Timeline View */}
              <div className="mt-6">
                <h2 className="mb-4 text-lg font-semibold">Timeline</h2>
                <CheckpointList
                  checkpoints={checkpoints}
                  loading={loading}
                  onCheckpointClick={handleCheckpointClick}
                  onCompare={handleCompare}
                />
              </div>
            </>
          )}
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
      <CreateCheckpointDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
        onCheckpointCreated={handleCheckpointCreated}
      />
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
