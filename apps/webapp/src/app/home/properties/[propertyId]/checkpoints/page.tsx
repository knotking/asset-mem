'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, List, ClipboardList } from 'lucide-react';
import { CheckpointList } from '@/components/checkpoints/checkpoint-list';
import { CreateCheckpointDialog } from '@/components/checkpoints/create-checkpoint-dialog';
import { CheckpointDetailDialog } from '@/components/checkpoints/checkpoint-detail-dialog';
import { CheckpointComparisonDialog } from '@/components/checkpoints/checkpoint-comparison-dialog';
import { MetricsDashboard } from '@/components/checkpoints/metrics-dashboard';
import { GenerateReportDialog } from '@/components/reports/generate-report-dialog';
import { ReportsList } from '@/components/reports/reports-list';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { usePreferences } from '@/contexts/preferences-context';
import { Checkpoint, PropertyReport } from '@/lib/types';
import { cn } from '@/lib/utils';
import { APP_NAV_TAB_CLASS, APP_PAGE_SUBTITLE_CLASS, APP_SECTION_TITLE_CLASS } from '@/lib/app-typography';

type TimelineTab = 'checkpoints' | 'insights' | 'reports';

const TIMELINE_TAB_LABELS: Record<TimelineTab, string> = {
  checkpoints: 'Checkpoints',
  insights: 'Insights',
  reports: 'Reports',
};

const TIMELINE_TAB_DESCRIPTIONS: Record<TimelineTab, string> = {
  checkpoints: 'Checkpoint history and comparisons',
  insights: 'Condition trends and severity over time',
  reports: 'Generated property reports',
};

function TimelineHeader({
  activeTab,
  onAddCheckpoint,
  onCreateReport,
}: {
  activeTab: TimelineTab;
  onAddCheckpoint: () => void;
  onCreateReport: () => void;
}) {
  const label = TIMELINE_TAB_LABELS[activeTab];
  const description = TIMELINE_TAB_DESCRIPTIONS[activeTab];

  return (
    <header className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:flex sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className={cn(APP_SECTION_TITLE_CLASS, 'hidden sm:block')}>{label}</h1>
        <p
          className={cn(
            APP_PAGE_SUBTITLE_CLASS,
            'min-h-10 line-clamp-2 sm:mt-0 sm:min-h-0 sm:line-clamp-none',
          )}
        >
          <span className="sr-only sm:hidden">{label}. </span>
          {description}
        </p>
      </div>
      <div className="flex min-h-8 w-[9.5rem] shrink-0 items-center justify-end sm:min-h-0 sm:w-auto sm:pt-0.5">
        {activeTab === 'checkpoints' ? (
          <Button
            size="sm"
            className="h-8 max-w-[9.5rem] shrink-0 px-2.5 text-xs whitespace-nowrap sm:h-10 sm:max-w-none sm:px-4 sm:text-sm"
            onClick={onAddCheckpoint}
          >
            <Plus className="mr-1 h-4 w-4 sm:mr-2" />
            Add Checkpoint
          </Button>
        ) : activeTab === 'reports' ? (
          <Button
            size="sm"
            className="h-8 shrink-0 px-2.5 text-xs whitespace-nowrap sm:h-10 sm:px-4 sm:text-sm"
            onClick={onCreateReport}
          >
            <Plus className="mr-1 h-4 w-4 sm:mr-2" />
            Create Report
          </Button>
        ) : (
          <span className="block w-full sm:hidden" aria-hidden />
        )}
      </div>
    </header>
  );
}

function parseTimelineTab(value: string | null): TimelineTab {
  if (value === 'reports') return 'reports';
  if (value === 'insights') return 'insights';
  return 'checkpoints';
}

export default function PropertyCheckpointsPage() {
  const { user, authPending } = useRequireAuth();
  const { checkpoints, loading, setSelectedCheckpoint } = useCheckpoint();
  const { updatePreferences } = usePreferences();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TimelineTab>(() =>
    parseTimelineTab(searchParams.get('tab'))
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [comparisonCheckpoints, setComparisonCheckpoints] = useState<
    [Checkpoint, Checkpoint] | null
  >(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [regenerateFrom, setRegenerateFrom] = useState<PropertyReport | null>(null);

  useEffect(() => {
    setActiveTab(parseTimelineTab(searchParams.get('tab')));
  }, [searchParams]);

  const selectTab = (tab: TimelineTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'checkpoints') params.delete('tab');
    else params.set('tab', tab);
    const query = params.toString();
    router.replace(query ? `?${query}` : '?', { scroll: false });
  };

  if (authPending || !user) {
    return null;
  }

  const handleCheckpointCreated = () => {
    selectTab('checkpoints');
  };

  const handleCheckpointClick = (checkpoint: Checkpoint) => {
    setSelectedCheckpoint(checkpoint);
  };

  const handleCompare = (checkpoint1: Checkpoint, checkpoint2: Checkpoint) => {
    void updatePreferences({ discoveryCompareDone: true });
    setComparisonCheckpoints([checkpoint1, checkpoint2]);
    setIsComparisonOpen(true);
  };

  return (
    <>
      <div className="mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
          <TimelineHeader
            activeTab={activeTab}
            onAddCheckpoint={() => setIsCreateDialogOpen(true)}
            onCreateReport={() => {
              setRegenerateFrom(null);
              setGenerateOpen(true);
            }}
          />

          <div className="mb-6 overflow-x-auto border-b">
            <nav className="flex min-w-max gap-4 sm:min-w-0 sm:gap-6" aria-label="Timeline tabs">
              <button
                type="button"
                onClick={() => selectTab('checkpoints')}
                className={cn(
                  'relative pb-3 transition-colors hover:text-foreground',
                  APP_NAV_TAB_CLASS,
                  activeTab === 'checkpoints' ? 'text-foreground' : 'text-muted-foreground'
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
                type="button"
                onClick={() => selectTab('insights')}
                className={cn(
                  'relative pb-3 transition-colors hover:text-foreground',
                  APP_NAV_TAB_CLASS,
                  activeTab === 'insights' ? 'text-foreground' : 'text-muted-foreground'
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
              <button
                type="button"
                onClick={() => selectTab('reports')}
                className={cn(
                  'relative pb-3 transition-colors hover:text-foreground',
                  APP_NAV_TAB_CLASS,
                  activeTab === 'reports' ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Reports
                </div>
                {activeTab === 'reports' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            </nav>
          </div>

          {activeTab === 'checkpoints' ? (
            <CheckpointList
              checkpoints={checkpoints}
              loading={loading}
              onCheckpointClick={handleCheckpointClick}
              onCompare={handleCompare}
            />
          ) : activeTab === 'insights' ? (
            <>
              <MetricsDashboard />
              <div className="mt-6">
                <h2 className={cn(APP_SECTION_TITLE_CLASS, 'mb-4')}>Checkpoint history</h2>
                <CheckpointList
                  checkpoints={checkpoints}
                  loading={loading}
                  onCheckpointClick={handleCheckpointClick}
                  onCompare={handleCompare}
                />
              </div>
            </>
          ) : (
            <ReportsList
              onRegenerate={(report) => {
                setRegenerateFrom(report);
                setGenerateOpen(true);
              }}
            />
          )}
      </div>

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
      <GenerateReportDialog
        open={generateOpen}
        onOpenChange={(open) => {
          setGenerateOpen(open);
          if (!open) setRegenerateFrom(null);
        }}
        regenerateFrom={regenerateFrom}
      />
    </>
  );
}
