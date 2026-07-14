import * as React from 'react';
import { View, FlatList, Image, Pressable, Modal, ScrollView, Animated } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Camera,
  Plus,
  Calendar,
  MapPin,
  ChevronRight,
  CheckCircle,
  Circle,
  ArrowRightLeft,
  Loader2,
  AlertCircle,
  Info,
  Play,
  X,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  SlidersHorizontal,
} from 'lucide-react-native';
import {
  CHECKPOINT_PAGE_SIZE,
  useCheckpoint,
} from '@homeapp/common/contexts/checkpoint-context';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useProperty } from '@homeapp/common/contexts/property-context';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
import { Checkpoint } from '@homeapp/common/types';
import { format } from 'date-fns';
import { CreateCheckpointModal } from './CreateCheckpointModal';
import { CheckpointDetailModal } from './CheckpointDetailModal';
import { CheckpointComparisonModal } from './CheckpointComparisonModal';
import { CheckpointProcessingModal } from './CheckpointProcessingModal';
import * as ImagePicker from 'expo-image-picker';

import {
  CHECKPOINT_QUOTA_USER_MESSAGE,
  checkpointFailureBadgeLabel,
  getPlanLimitFailureMessage,
} from '@homeapp/common/lib/document-analysis-errors';
import { deleteCheckpointsBatch } from '@homeapp/common/lib/deletion/delete-checkpoint';
import {
  checkpointBulkDeleteFailed,
  deletionRetryLabel,
  isResourceDeletionFailed,
  markResourcesDeletionFailed,
  resourceDeletingLabel,
  deletionErrorLabel,
} from '@homeapp/common/lib/deletion';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import { doc } from 'firebase/firestore';
import { getMappDeletionApiUrls } from '@/lib/deletion-api';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import {
  isAtPlanLimit,
  planLimitBlockMessage,
  planLimitUsageHint,
} from '@homeapp/common/lib/plan-limit-slice';
import { getCheckpointListConditionBadge } from '@homeapp/common/lib/checkpoint-list-badge';
import { checkpointListBadgeStyles } from '@/lib/checkpoint-list-badge-styles';
import { Input } from '@/components/ui/input';
import { useLlmTokenUsage } from '@homeapp/common/contexts/llm-token-usage-context';
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
import { analyzeCheckpoint } from '../../lib/api';
import { createLogger } from '@/lib/logger';
import { useThemedAlert } from '@/contexts/themed-alert-context';

const checkpointLog = createLogger('checkpoint');
import { usePropertyCheckpointMetrics } from '@/hooks/usePropertyCheckpointMetrics';
import {
  formatMetricsHeadlineDisplay,
  getMetricsHeadlineScore,
  getMetricsStatus,
  INSIGHTS_MISSING_SUMMARY_HINT,
  INSIGHTS_MISSING_SUMMARY_MESSAGE,
  resolveInsightsViewState,
} from '@homeapp/common/lib/checkpoint-metrics-display';
import type { PropertyCheckpointIssueRow } from '@homeapp/common/types';

type IssueSeverity = 'critical' | 'major' | 'moderate' | 'minor';
type IssueRow = {
  severity: IssueSeverity;
  description: string;
  checkpointId: string;
  checkpointName: string;
  createdAt: Date;
};

function normalizeIssuesFromCheckpoints(
  checkpoints: Checkpoint[],
  maxCheckpoints: number
): IssueRow[] {
  const rows: IssueRow[] = [];
  const slice = checkpoints.slice(0, maxCheckpoints);
  for (const cp of slice) {
    const issues = cp.aiAnalysis?.issues as any[] | undefined;
    if (!issues || issues.length === 0) continue;
    const createdAt = cp.createdAt?.toDate ? cp.createdAt.toDate() : new Date();
    for (const issue of issues) {
      if (typeof issue === 'string') {
        rows.push({
          severity: 'minor',
          description: issue,
          checkpointId: cp.id,
          checkpointName: cp.name || 'Untitled Checkpoint',
          createdAt,
        });
      } else if (issue && typeof issue === 'object') {
        const sev: IssueSeverity =
          issue.severity === 'critical' ||
          issue.severity === 'major' ||
          issue.severity === 'moderate'
            ? issue.severity
            : 'minor';
        const desc = String(issue.description || issue.text || issue.title || 'Issue detected');
        rows.push({
          severity: sev,
          description: desc,
          checkpointId: cp.id,
          checkpointName: cp.name || 'Untitled Checkpoint',
          createdAt,
        });
      }
    }
  }
  // newest first
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return rows;
}

function severityLabel(sev: IssueSeverity) {
  return sev === 'critical'
    ? 'Critical'
    : sev === 'major'
      ? 'Major'
      : sev === 'moderate'
        ? 'Moderate'
        : 'Minor';
}

function CheckpointsTabSkeleton() {
  return (
    <View className="flex-1 p-4">
      {/* Property Insights Skeleton */}
      <PropertyInsightsSkeletonCard />

      {/* Header Skeleton */}
      <View className="mb-4 flex-row items-center justify-between">
        <Skeleton className="h-7 w-32 rounded" />
        <View className="flex-row gap-2">
          <Skeleton className="h-9 w-10 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </View>
      </View>

      {/* List Skeleton */}
      <View className="gap-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Card key={idx} className="p-2">
            <View className="flex-row overflow-hidden rounded-lg">
              <Skeleton className="h-24 w-24 rounded-md" />
              <View className="flex-1 justify-between p-3">
                <View>
                  <View className="flex-row items-start justify-between">
                    <Skeleton className="h-4 w-40 rounded" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </View>
                  <Skeleton className="mt-2 h-3 w-28 rounded" />
                </View>
                <View className="flex-row items-center justify-between">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-4 w-4 rounded" />
                </View>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

function PropertyInsightsSkeletonCard() {
  return (
    <Card className="mb-4">
      <View className="p-4">
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </View>
        <Skeleton className="mt-2 h-3 w-48 rounded" />

        <View className="mt-4 flex-row justify-between">
          <View>
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="mt-2 h-7 w-20 rounded" />
            <Skeleton className="mt-2 h-3 w-16 rounded" />
            <Skeleton className="mt-3 h-2 w-40 rounded-full" />
          </View>
          <View>
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="mt-2 h-4 w-36 rounded" />
            <Skeleton className="mt-2 h-3 w-24 rounded" />
          </View>
        </View>

        <View className="mt-4">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="mt-2 h-4 w-full rounded" />
          <Skeleton className="mt-2 h-3 w-3/4 rounded" />
        </View>
      </View>
    </Card>
  );
}

function PropertyMetricsCard({
  checkpoints,
  onOpenIssues,
}: {
  checkpoints: Checkpoint[];
  onOpenIssues: () => void;
}) {
  const { metrics, loading, summaryExists } = usePropertyCheckpointMetrics();
  const viewState = resolveInsightsViewState({ loading, summaryExists });

  // Crossfade skeleton -> content to avoid a "pop" when metrics arrives.
  const contentOpacity = React.useRef(new Animated.Value(viewState === 'ready' ? 1 : 0)).current;
  const skeletonOpacity = React.useRef(new Animated.Value(viewState === 'loading' ? 1 : 0)).current;

  React.useEffect(() => {
    const hasMetrics = viewState === 'ready';
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: hasMetrics ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(skeletonOpacity, {
        toValue: hasMetrics ? 0 : 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [viewState, contentOpacity, skeletonOpacity]);

  if (viewState === 'loading') {
    return (
      <Animated.View style={{ opacity: skeletonOpacity }}>
        <PropertyInsightsSkeletonCard />
      </Animated.View>
    );
  }

  if (viewState === 'missing_summary') {
    return (
      <Card className="mb-4">
        <View className="p-4">
          <Text className="text-lg font-semibold text-foreground">Property Health Insights</Text>
          <Text className="mt-2 text-sm text-muted-foreground">{INSIGHTS_MISSING_SUMMARY_MESSAGE}</Text>
          <Text className="mt-1 text-xs text-muted-foreground">{INSIGHTS_MISSING_SUMMARY_HINT}</Text>
        </View>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  const status = getMetricsStatus(metrics);
  const headlineScore = getMetricsHeadlineScore(metrics);
  const issues = metrics.issues?.total_by_severity;
  const rate = metrics.deterioration?.rate_points_per_day;
  const trend = metrics.deterioration?.trend;
  const considered = metrics.window?.checkpoints_considered;
  const scored = metrics.window?.checkpoints_with_score ?? 0;

  return (
    <View className="mb-4">
      {/* Skeleton layer (under/over) */}
      <Animated.View
        style={{ position: 'absolute', left: 0, right: 0, top: 0, opacity: skeletonOpacity }}>
        <PropertyInsightsSkeletonCard />
      </Animated.View>

      {/* Content layer */}
      <Animated.View style={{ opacity: contentOpacity }}>
        <Card>
          <View className="p-4">
            {/* Header */}
            <View className="mb-4 flex-row items-center gap-2">
              <Icon as={Activity} size={20} className="text-foreground" />
              <Text className="text-lg font-semibold text-foreground">Property Health Insights</Text>
            </View>

            {/* Two-column layout (stacked on mobile) */}
            <View className="gap-6">

            {/* Overall Condition */}
            <View>
              <Text className="mb-3 text-sm font-semibold text-muted-foreground">Overall Condition</Text>
              {(() => {
                const latestScoreDisplay = formatMetricsHeadlineDisplay(headlineScore);
                const latestScoreNum =
                  headlineScore !== null && Number.isFinite(headlineScore)
                    ? Math.max(0, Math.min(100, headlineScore))
                    : null;
                
                const getTrendIcon = () => {
                  switch (trend) {
                    case 'improving':
                      return <Icon as={TrendingUp} size={16} className="text-green-600" />;
                    case 'deteriorating':
                      return <Icon as={TrendingDown} size={16} className="text-red-600" />;
                    case 'stable':
                      return <Icon as={Minus} size={16} className="text-blue-600" />;
                    default:
                      return <Icon as={Activity} size={16} className="text-gray-600" />;
                  }
                };

                const getTrendColor = () => {
                  switch (trend) {
                    case 'improving':
                      return 'text-green-600';
                    case 'deteriorating':
                      return 'text-red-600';
                    case 'stable':
                      return 'text-blue-600';
                    default:
                      return 'text-gray-600';
                  }
                };

                const getScoreColor = (display: string) => {
                  if (display === '—') return 'text-muted-foreground';
                  const score = Number(display);
                  if (score >= 80) return 'text-green-600';
                  if (score >= 60) return 'text-yellow-600';
                  if (score >= 40) return 'text-orange-600';
                  return 'text-red-600';
                };

                const showTrendBadge =
                  trend !== 'unknown' &&
                  scored >= 2 &&
                  typeof rate === 'number' &&
                  Number.isFinite(rate);

                const trendLabelDisplay =
                  trend === 'improving'
                    ? 'Improving'
                    : trend === 'stable'
                      ? 'Stable'
                      : trend === 'deteriorating'
                        ? 'Deteriorating'
                        : 'Unknown';

                const deteriorationRate = typeof rate === 'number' && Number.isFinite(rate) ? rate : 0;
                const trendData = metrics.overall?.trend || [];
                const statusSubcopy =
                  status === 'pending_analysis'
                    ? 'Scores appear after AI analysis finishes.'
                    : status === 'partial'
                      ? `Based on ${scored} of ${considered ?? 0} recent checkpoints`
                      : status === 'ready'
                        ? 'Property health index (0–100), average of recent checkpoints'
                        : '';

                return (
                  <>
                    <View className="flex-row items-end gap-3">
                      <Text className={`text-5xl font-bold ${getScoreColor(latestScoreDisplay)}`}>
                        {latestScoreDisplay}
                      </Text>
                      {showTrendBadge && (
                        <View className="mb-2">
                          <View className="flex-row items-center gap-1 rounded-full border border-border bg-card px-2 py-1">
                            {getTrendIcon()}
                            <Text className={`text-xs ${getTrendColor()}`}>
                              {trendLabelDisplay}
                            </Text>
                          </View>
                          {deteriorationRate !== 0 && (
                            <Text className="mt-1 text-xs text-muted-foreground">
                              {Math.abs(deteriorationRate).toFixed(2)} pts/day
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                    {statusSubcopy ? (
                      <Text className="mt-2 text-xs text-muted-foreground">{statusSubcopy}</Text>
                    ) : null}
                    {latestScoreNum === null && status !== 'pending_analysis' ? (
                      <Text className="mt-1 text-xs text-muted-foreground">
                        No condition score yet for recent checkpoints.
                      </Text>
                    ) : null}

                    {/* Trend Chart (Mini) */}
                    {trendData.length > 0 && (
                      <View className="mt-4">
                        <View className="flex-row h-16 items-end gap-1">
                          {trendData.slice(-12).map((point: any, idx: number) => {
                            const height = (point.score / 100) * 100;
                            return (
                              <View
                                key={idx}
                                className="flex-1 rounded-t bg-primary/20"
                                style={{ height: `${height}%` }}
                              />
                            );
                          })}
                        </View>
                        <Text className="mt-2 text-xs text-muted-foreground">
                          Trend over last {trendData.length} checkpoint{trendData.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </View>

              {/* Issues Breakdown */}
              <View>
                <Text className="mb-3 text-sm font-semibold text-muted-foreground">Issues by Severity</Text>
                {issues ? (
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Icon as={AlertCircle} size={16} className="text-red-600" />
                        <Text className="text-sm font-medium text-foreground">Critical</Text>
                      </View>
                      <View className="rounded-full bg-red-100 px-2 py-1 border border-red-200">
                        <Text className="text-xs font-medium text-red-800">
                          {issues.critical}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Icon as={AlertCircle} size={16} className="text-orange-600" />
                        <Text className="text-sm font-medium text-foreground">Major</Text>
                      </View>
                      <View className="rounded-full bg-orange-100 px-2 py-1 border border-orange-200">
                        <Text className="text-xs font-medium text-orange-800">
                          {issues.major}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Icon as={AlertCircle} size={16} className="text-yellow-600" />
                        <Text className="text-sm font-medium text-foreground">Moderate</Text>
                      </View>
                      <View className="rounded-full bg-yellow-100 px-2 py-1 border border-yellow-200">
                        <Text className="text-xs font-medium text-yellow-800">
                          {issues.moderate}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Icon as={AlertCircle} size={16} className="text-blue-600" />
                        <Text className="text-sm font-medium text-foreground">Minor</Text>
                      </View>
                      <View className="rounded-full bg-blue-100 px-2 py-1 border border-blue-200">
                        <Text className="text-xs font-medium text-blue-800">
                          {issues.minor}
                        </Text>
                      </View>
                    </View>

                    <Pressable onPress={onOpenIssues} className="mt-4 rounded-lg border border-border bg-muted p-3">
                      <Text className="text-sm font-semibold text-foreground">
                        Total Issues: {(issues.critical || 0) + (issues.major || 0) + (issues.moderate || 0) + (issues.minor || 0)}
                      </Text>
                      <Text className="mt-1 text-xs text-muted-foreground">
                        Tap to see detailed breakdown
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text className="text-sm text-muted-foreground">No issues data available</Text>
                )}
              </View>
            </View>

            {/* Metadata */}
            {metrics.updatedAt && (
              <View className="mt-4 border-t border-border pt-4">
                <Text className="text-xs text-muted-foreground">
                  Last updated: {format(
                    metrics.updatedAt.toDate ? metrics.updatedAt.toDate() : new Date(metrics.updatedAt as any),
                    'PPp'
                  )}
                  {typeof considered === 'number' && considered > 0 && (
                    <> · Based on {considered} checkpoint{considered === 1 ? '' : 's'}</>
                  )}
                </Text>
              </View>
            )}

            {true && (
              <View className="mt-3 rounded-lg border border-border bg-card p-3">
                <Text className="text-sm font-semibold text-foreground">How to read this</Text>
                <View className="mt-2 gap-1">
                  <Text className="text-xs text-muted-foreground">
                    - Overall condition is a 0–100 index averaged across your recent checkpoint
                    photos.
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    - Change rate is how fast the score is moving over time (points/day).
                    “Worsening” means the score is trending down.
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    - Issues are grouped by severity (minor → critical) based on AI classification.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Card>
      </Animated.View>
    </View>
  );
}

function CheckpointCard({
  checkpoint,
  onPress,
  onLongPress,
  selectionMode,
  isSelected,
  isDeleting,
  isDeleteFailed,
  onRetryDelete,
}: {
  checkpoint: Checkpoint;
  onPress: (checkpoint: Checkpoint) => void;
  onLongPress?: (checkpoint: Checkpoint) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  isDeleting?: boolean;
  isDeleteFailed?: boolean;
  onRetryDelete?: (checkpoint: Checkpoint) => void;
}) {
  const media0 = checkpoint.media?.[0];
  const thumbnail = checkpoint.media?.[0]?.thumbnailUrl || checkpoint.media?.[0]?.url;
  const isVideo = !!media0?.contentType?.startsWith('video/');
  const date = checkpoint.createdAt?.toDate ? checkpoint.createdAt.toDate() : new Date();
  const conditionBadge = getCheckpointListConditionBadge(checkpoint);
  const conditionBadgeStyles = conditionBadge
    ? checkpointListBadgeStyles(conditionBadge.variant)
    : null;

  return (
    <Card className={`relative p-2 ${isSelected ? 'border-primary bg-primary/5' : ''} ${isDeleting ? 'opacity-90' : ''}`}>
      <Pressable
        onPress={isDeleting ? undefined : () => onPress(checkpoint)}
        onLongPress={isDeleting ? undefined : () => onLongPress?.(checkpoint)}
        disabled={isDeleting}
        className="flex-row overflow-hidden rounded-lg">
        {/* Thumbnail Image */}
        <View className="h-24 w-24 bg-muted">
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Icon as={Camera} size={24} className="text-muted-foreground" />
            </View>
          )}
          {isVideo && (
            <View className="absolute inset-0 items-center justify-center">
              <View className="rounded-full bg-black/50 p-2">
                <Icon as={Play} size={18} className="text-white" />
              </View>
            </View>
          )}
          {selectionMode && (
            <View className="absolute left-2 top-2 rounded-full bg-background/80 p-1">
              <Icon
                as={isSelected ? CheckCircle : Circle}
                size={20}
                className={isSelected ? 'text-primary' : 'text-muted-foreground'}
              />
            </View>
          )}
        </View>

        {/* Content */}
        <View className="flex-1 justify-between p-3">
          <View>
            <View className="flex-row items-start justify-between gap-2">
              <Text
                className="min-w-0 flex-1 shrink font-semibold text-foreground"
                numberOfLines={1}>
                {checkpoint.name || 'Untitled Checkpoint'}
              </Text>
              <View className="shrink-0 flex-row flex-wrap items-center justify-end gap-1">
                {/* Analysis Status Badge */}
                {checkpoint.analysisStatus === 'processing' && (
                  <View className="flex-row items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5">
                    <Icon as={Loader2} size={10} className="animate-spin text-primary" />
                    <Text className="text-[10px] font-medium text-primary">Analyzing</Text>
                  </View>
                )}
                {checkpoint.analysisStatus === 'failed' && (
                  <View className="flex-row items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5">
                    <Icon as={AlertCircle} size={10} className="text-destructive" />
                    <Text className="text-[10px] font-medium text-destructive">
                      {checkpointFailureBadgeLabel(checkpoint)}
                    </Text>
                  </View>
                )}
                {conditionBadge && conditionBadgeStyles && (
                  <View className={conditionBadgeStyles.containerClass}>
                    <Text className={conditionBadgeStyles.textClass}>{conditionBadge.label}</Text>
                  </View>
                )}
              </View>
            </View>

            {checkpoint.location && (
              <View className="mt-1 flex-row items-center gap-1">
                <Icon as={MapPin} size={12} className="text-muted-foreground" />
                <Text className="text-xs text-muted-foreground">{checkpoint.location}</Text>
              </View>
            )}

            {isDeleteFailed ? (
              <View className="mt-1 gap-1">
                <View className="flex-row items-center gap-1">
                  <Icon as={AlertCircle} size={12} className="text-destructive" />
                  <Text className="flex-1 text-xs text-destructive">
                    {deletionErrorLabel(checkpoint.deletionError)}
                  </Text>
                </View>
                {onRetryDelete ? (
                  <Button variant="outline" size="sm" onPress={() => onRetryDelete(checkpoint)}>
                    <Text className="text-xs">{deletionRetryLabel}</Text>
                  </Button>
                ) : null}
              </View>
            ) : null}
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1">
              <Icon as={Calendar} size={12} className="text-muted-foreground" />
              <Text className="text-xs text-muted-foreground">{format(date, 'MMM d, yyyy')}</Text>
            </View>

            {!selectionMode && (
              <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
            )}
          </View>
        </View>
      </Pressable>
      {isDeleting ? (
        <View className="absolute inset-0 items-center justify-center rounded-lg bg-background/90">
          <View className="flex-row items-center gap-2">
            <Icon as={Loader2} size={16} className="animate-spin text-muted-foreground" />
            <Text className="text-sm font-medium text-foreground">{resourceDeletingLabel}</Text>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

import { PropertyReportsSegment } from '@/components/property-details/PropertyReportsSegment';
import type { TimelineSubTab } from '@/components/property-details/property-screen-tab';

interface PropertyCheckpointsTabProps {
  isCreateModalVisible: boolean;
  setIsCreateModalVisible: (visible: boolean) => void;
  setActiveTab: (tab: 'chat' | 'details' | 'timeline') => void;
  initialSubTab?: TimelineSubTab;
  onSubTabChange?: (subTab: TimelineSubTab) => void;
  isGenerateReportModalVisible?: boolean;
  setIsGenerateReportModalVisible?: (visible: boolean) => void;
}

export function PropertyCheckpointsTab({
  isCreateModalVisible,
  setIsCreateModalVisible,
  setActiveTab,
  initialSubTab = 'checkpoints',
  onSubTabChange,
  isGenerateReportModalVisible,
  setIsGenerateReportModalVisible,
}: PropertyCheckpointsTabProps) {
  const { showAlert } = useThemedAlert();
  const {
    checkpoints,
    loading,
    isLoadingEarlier,
    hasMoreCheckpoints,
    loadMoreCheckpoints,
    createCheckpoint,
    updateCheckpoint,
    deleteCheckpoint,
    markCheckpointsDeleting,
    clearCheckpointsDeleting,
    isCheckpointDeletingOverlay,
  } = useCheckpoint();
  const { user } = useAuth();
  const { db } = useFirebase();
  const { checkpointsLimit, limitsLoading } = useLlmTokenUsage();
  const checkpointLimitMessage = planLimitBlockMessage('checkpoint', checkpointsLimit);
  const checkpointLimitHint = planLimitUsageHint('checkpoint', checkpointsLimit);
  const { property } = useProperty();
  const { updatePreferences } = usePreferences();
  const { metrics: propertyMetrics } = usePropertyCheckpointMetrics();

  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = React.useState<TimelineSubTab>(initialSubTab);

  React.useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  React.useEffect(() => {
    onSubTabChange?.(activeSubTab);
  }, [activeSubTab, onSubTabChange]);
  
  const [selectedCheckpoint, setSelectedCheckpoint] = React.useState<Checkpoint | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = React.useState(false);
  const [isIssuesModalVisible, setIsIssuesModalVisible] = React.useState(false);
  const [issuesFilter, setIssuesFilter] = React.useState<IssueSeverity | 'all'>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [locationFilter, setLocationFilter] = React.useState<string>('all');
  const [filterModalVisible, setFilterModalVisible] = React.useState(false);

  // Selection State (always active in 'select' sub-tab)
  const [selectedForActions, setSelectedForActions] = React.useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [isComparisonModalVisible, setIsComparisonModalVisible] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  // Processing feedback state
  const [isProcessingModalVisible, setIsProcessingModalVisible] = React.useState(false);
  const [newCheckpointId, setNewCheckpointId] = React.useState<string>('');
  const [newCheckpointName, setNewCheckpointName] = React.useState<string>('');

  const handleCreateCheckpoint = async (data: {
    name: string;
    assetType: 'real_estate' | 'vehicle' | 'appliance' | 'landscape_irrigation' | 'other';
    location: string;
    mediaAsset: ImagePicker.ImagePickerAsset;
    mediaType: 'image' | 'video';
  }) => {
    if (!limitsLoading && isAtPlanLimit(checkpointsLimit, 1)) {
      showAlert('Monthly checkpoint limit reached', CHECKPOINT_QUOTA_USER_MESSAGE);
      return;
    }

    try {
      const result = await createCheckpoint(
        {
          name: data.name,
          assetType: data.assetType,
          location: data.location,
        },
        [
          {
            uri: data.mediaAsset.uri,
            type: data.mediaType,
          },
        ]
      );
      
      // Set checkpoint data AND open processing modal BEFORE closing create modal
      // This ensures smooth transition without blank screen
      setNewCheckpointId(result.id);
      setNewCheckpointName(data.name || 'New Checkpoint');
      setIsProcessingModalVisible(true);
      
      // Close create modal after processing modal is open (using requestAnimationFrame for smooth transition)
      requestAnimationFrame(() => {
        setIsCreateModalVisible(false);
      });

      // Set status to pending initially
      await updateCheckpoint(result.id, {
        analysisStatus: 'pending',
      });

      // Trigger AI Analysis via Pub/Sub (truly async)
      const { id, media } = result;
      const firstMedia = media[0];

      if (firstMedia && firstMedia.gsURI && user && property) {
        // Update status to processing
        updateCheckpoint(id, {
          analysisStatus: 'processing',
        }).catch((err) => {
          checkpointLog.error('checkpoint.statusUpdate.failed', undefined, err);
        });

        // Publish to Pub/Sub for async processing (fire and forget)
        // Worker will update Firestore when analysis completes
        analyzeCheckpoint({
          imageUrl: firstMedia.gsURI,
          contentType: firstMedia.contentType,
          assetType: data.assetType,
          location: data.location,
          checkpointId: id,
          userId: user.uid,
          propertyId: property.id,
        }).catch((err) => {
          checkpointLog.error('checkpoint.analysis.publish.failed', undefined, err);
          const message = getPlanLimitFailureMessage(err);
          updateCheckpoint(id, {
            analysisStatus: 'failed',
            analysisFailureSummary: message,
          }).catch((updateErr) => {
            checkpointLog.error('checkpoint.statusFailedUpdate.failed', undefined, updateErr);
          });
          showAlert('Checkpoint analysis unavailable', message);
        });
      } else {
        // No image to analyze, mark as completed
        await updateCheckpoint(id, {
          analysisStatus: 'completed',
        });
      }
    } catch (error) {
      checkpointLog.error('checkpoint.create.failed', undefined, error);
    }
  };

  const handleViewNewCheckpoint = (checkpointId: string) => {
    // Close processing modal first
    setIsProcessingModalVisible(false);
    
    // Switch to 'checkpoints' tab (but don't auto-select since user is viewing detail)
    setActiveSubTab('checkpoints');
    
    // Find the checkpoint and open detail modal
    const checkpoint = checkpoints.find(cp => cp.id === checkpointId);
    if (checkpoint) {
      setSelectedCheckpoint(checkpoint);
      setIsDetailModalVisible(true);
    } else {
      // If checkpoint not yet in list, retry after a short delay
      setTimeout(() => {
        const retryCheckpoint = checkpoints.find(cp => cp.id === checkpointId);
        if (retryCheckpoint) {
          setSelectedCheckpoint(retryCheckpoint);
          setIsDetailModalVisible(true);
        }
      }, 500);
    }
  };

  const handleContinueFromProcessing = () => {
    setIsProcessingModalVisible(false);
    setActiveSubTab('checkpoints');
    setSelectedForActions([]);
    setIsSelectionMode(false);
  };

  const handleCheckpointPress = (checkpoint: Checkpoint) => {
    if (activeSubTab === 'checkpoints' && isSelectionMode) {
      // Toggle selection
      setSelectedForActions((prev) => {
        const newSelection = prev.includes(checkpoint.id)
          ? prev.filter((id) => id !== checkpoint.id)
          : [...prev, checkpoint.id];
          
        // Exit selection mode if no items selected
        if (newSelection.length === 0) {
          setIsSelectionMode(false);
        }
        
        return newSelection;
      });
    } else {
      // Open detail modal
      setSelectedCheckpoint(checkpoint);
      setIsDetailModalVisible(true);
    }
  };

  const handleCheckpointLongPress = (checkpoint: Checkpoint) => {
    if (activeSubTab === 'checkpoints') {
      setIsSelectionMode(true);
      setSelectedForActions((prev) => {
        if (!prev.includes(checkpoint.id)) {
          return [...prev, checkpoint.id];
        }
        return prev;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedForActions([]);
    setIsSelectionMode(false);
  };

  const handleCompare = () => {
    if (selectedForActions.length === 2) {
      void updatePreferences({ discoveryCompareDone: true });
      setIsComparisonModalVisible(true);
    }
  };
  
  const handleDeleteSelected = () => {
    if (selectedForActions.length > 0) {
      setIsDeleteConfirmOpen(true);
    }
  };

  const locationOptions = React.useMemo(() => {
    return Array.from(
      new Set(
        checkpoints
          .map((cp) => cp.location?.trim())
          .filter((location): location is string => !!location),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [checkpoints]);

  const filteredCheckpoints = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return checkpoints.filter((cp) => {
      const matchesLocation =
        locationFilter === 'all' ||
        (cp.location?.trim().toLowerCase() ?? '') === locationFilter.toLowerCase();
      if (!matchesLocation) return false;
      if (!term) return true;
      const fields = [cp.name, cp.location, cp.detectedAsset, cp.assetType, cp.description];
      return fields.some((value) => (value ?? '').toLowerCase().includes(term));
    });
  }, [checkpoints, searchTerm, locationFilter]);

  const hasActiveFilters = searchTerm.trim().length > 0 || locationFilter !== 'all';
  const activeFilterCount =
    (searchTerm.trim().length > 0 ? 1 : 0) + (locationFilter !== 'all' ? 1 : 0);

  const clearCheckpointFilters = React.useCallback(() => {
    setSearchTerm('');
    setLocationFilter('all');
  }, []);
  
  const runBulkDelete = React.useCallback(
    async (checkpointIds: string[]) => {
      if (!user || !property || checkpointIds.length === 0) return;
      const deletionUrls = getMappDeletionApiUrls();
      if (!deletionUrls?.checkpointsBatch) {
        showAlert('Error', 'Deletion API is not configured.');
        clearCheckpointsDeleting(checkpointIds);
        return;
      }
      try {
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
      } catch (error) {
        checkpointLog.error('checkpoints.bulkDelete.failed', undefined, error);
        if (user && property) {
          const refs = checkpointIds.map((id) =>
            doc(db, 'users', user.uid, 'properties', property.id, 'checkpoints', id)
          );
          await markResourcesDeletionFailed(db, refs, error);
        }
        showAlert('Error', checkpointBulkDeleteFailed);
      } finally {
        clearCheckpointsDeleting(checkpointIds);
      }
    },
    [user, property, db, clearCheckpointsDeleting]
  );

  const handleRetryDeleteCheckpoint = React.useCallback(
    (checkpoint: Checkpoint) => {
      void deleteCheckpoint(checkpoint.id).catch((error) => {
        checkpointLog.error('checkpoint.retryDelete.failed', undefined, error);
        showAlert('Error', checkpointBulkDeleteFailed);
      });
    },
    [deleteCheckpoint]
  );

  const confirmDelete = React.useCallback(() => {
    const checkpointIds = [...selectedForActions];
    if (checkpointIds.length === 0) return;
    setIsDeleteConfirmOpen(false);
    setSelectedForActions([]);
    setIsSelectionMode(false);
    markCheckpointsDeleting(checkpointIds);
    void runBulkDelete(checkpointIds);
  }, [selectedForActions, markCheckpointsDeleting, runBulkDelete]);

  // Render content based on state
  let content;
  
  if (loading) {
    content = <CheckpointsTabSkeleton />;
  } else if (checkpoints.length === 0) {
    content = (
      <View className="flex-1">
        <View className="flex-row border-b border-border px-4">
          <Pressable
            onPress={() => setActiveSubTab('checkpoints')}
            className={`flex-1 py-3 ${activeSubTab === 'checkpoints' ? 'border-b-2 border-primary' : ''}`}>
            <Text
              className={`text-center font-medium ${
                activeSubTab === 'checkpoints' ? 'text-primary' : 'text-muted-foreground'
              }`}>
              Checkpoints
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveSubTab('insights')}
            className={`flex-1 py-3 ${activeSubTab === 'insights' ? 'border-b-2 border-primary' : ''}`}>
            <Text
              className={`text-center font-medium ${
                activeSubTab === 'insights' ? 'text-primary' : 'text-muted-foreground'
              }`}>
              Insights
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveSubTab('reports')}
            className={`flex-1 py-3 ${activeSubTab === 'reports' ? 'border-b-2 border-primary' : ''}`}>
            <Text
              className={`text-center font-medium ${
                activeSubTab === 'reports' ? 'text-primary' : 'text-muted-foreground'
              }`}>
              Reports
            </Text>
          </Pressable>
        </View>
        {activeSubTab === 'reports' ? (
          <PropertyReportsSegment
            generateModalVisible={isGenerateReportModalVisible}
            onGenerateModalVisibleChange={setIsGenerateReportModalVisible}
          />
        ) : (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Card className="mb-4 border-dashed border-border">
          <View className="px-4 py-1">
            <View className="mb-2 flex-row items-center gap-2">
              <Icon as={Info} size={18} className="text-primary" />
              <Text className="text-base font-semibold text-foreground">Property Insights</Text>
            </View>
            <Text className="text-sm text-muted-foreground">
              Once you create checkpoints, you'll see AI-powered insights here including:
            </Text>
            <View className="mt-3 gap-2">
              <View className="flex-row items-start gap-2">
                <View className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <Text className="flex-1 text-xs text-muted-foreground">
                  Overall condition score (0–100) based on your checkpoint photos
                </Text>
              </View>
              <View className="flex-row items-start gap-2">
                <View className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <Text className="flex-1 text-xs text-muted-foreground">
                  Change rate tracking to see if your property is improving or deteriorating
                </Text>
              </View>
              <View className="flex-row items-start gap-2">
                <View className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <Text className="flex-1 text-xs text-muted-foreground">
                  Issue detection grouped by severity (critical, major, moderate, minor)
                </Text>
              </View>
            </View>
          </View>
        </Card>
        <Card
          className="items-center"
          style={{ paddingTop: 24, paddingHorizontal: 24, paddingBottom: 16 }}>
          <View className="mb-1 h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Icon as={Camera} size={32} className="text-primary" />
          </View>
          <Text className="mb-1 text-center text-lg font-semibold text-foreground">
            No Checkpoints Yet
          </Text>
          <Text className="mb-3 text-center text-sm text-muted-foreground">
            Create your first checkpoint to start tracking changes over time.
          </Text>
          {(checkpointLimitHint || checkpointLimitMessage) ? (
            <Text
              className={`mb-2 text-center text-sm ${
                checkpointLimitMessage ? 'text-destructive' : 'text-muted-foreground'
              }`}>
              {checkpointLimitMessage ?? checkpointLimitHint}
            </Text>
          ) : null}
          <Button
            onPress={() => {
              if (!limitsLoading && isAtPlanLimit(checkpointsLimit, 1)) {
                showAlert(
                  'Monthly checkpoint limit reached',
                  CHECKPOINT_QUOTA_USER_MESSAGE,
                );
                return;
              }
              setIsCreateModalVisible(true);
            }}
            className="w-full"
          >
            <View className="flex-row items-center gap-2">
              <Icon as={Plus} size={20} className="text-primary-foreground" />
              <Text className="text-primary-foreground">Create Checkpoint</Text>
            </View>
          </Button>
        </Card>
      </ScrollView>
        )}
      </View>
    );
  } else {
    // Main view with checkpoints
    content = (

      <View className="flex-1">
        {/* Sub-tabs */}
        <View className="flex-row border-b border-border px-4">
        <Pressable
          onPress={() => {
            setActiveSubTab('checkpoints');
            setSelectedForActions([]);
            setIsSelectionMode(false);
          }}
          className={`flex-1 py-3 ${activeSubTab === 'checkpoints' ? 'border-b-2 border-primary' : ''}`}>
          <Text
            className={`text-center font-medium ${
              activeSubTab === 'checkpoints' ? 'text-primary' : 'text-muted-foreground'
            }`}>
            Checkpoints
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveSubTab('insights')}
          className={`flex-1 py-3 ${activeSubTab === 'insights' ? 'border-b-2 border-primary' : ''}`}>
          <Text
            className={`text-center font-medium ${
              activeSubTab === 'insights' ? 'text-primary' : 'text-muted-foreground'
            }`}>
            Insights
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveSubTab('reports')}
          className={`flex-1 py-3 ${activeSubTab === 'reports' ? 'border-b-2 border-primary' : ''}`}>
          <Text
            className={`text-center font-medium ${
              activeSubTab === 'reports' ? 'text-primary' : 'text-muted-foreground'
            }`}>
            Reports
          </Text>
        </Pressable>
      </View>

      {/* Checkpoints Sub-tab Content */}
      {activeSubTab === 'checkpoints' && (
        <View className="flex-1 p-4">
          <View className="mb-3 gap-2">
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Input
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="Search checkpoints by name or location..."
                  className="h-10 border-border bg-background pl-9 pr-3 text-sm"
                />
                <View className="pointer-events-none absolute left-3 top-0 h-10 items-center justify-center">
                  <Icon as={Search} size={16} className="text-muted-foreground" />
                </View>
              </View>
              <Button
                variant="outline"
                onPress={() => setFilterModalVisible(true)}
                className={`h-10 px-3 ${activeFilterCount > 0 ? 'border-primary bg-primary/5' : ''}`}>
                <View className="flex-row items-center gap-1.5">
                  <Icon
                    as={SlidersHorizontal}
                    size={16}
                    className={activeFilterCount > 0 ? 'text-primary' : 'text-foreground'}
                  />
                  <Text className={activeFilterCount > 0 ? 'text-primary' : 'text-foreground'}>
                    {activeFilterCount > 0 ? `Filter · ${activeFilterCount}` : 'Filter'}
                  </Text>
                </View>
              </Button>
            </View>
            {hasActiveFilters ? (
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">
                  Showing {filteredCheckpoints.length} of {checkpoints.length} checkpoints
                </Text>
                <Button variant="link" onPress={clearCheckpointFilters} className="h-7 px-0">
                  <Text className="text-xs text-primary">Clear filters</Text>
                </Button>
              </View>
            ) : null}
          </View>

          {/* Selection indicator and action buttons */}
          {isSelectionMode && (
            <View className="mb-4 rounded-lg border border-border bg-secondary/50 p-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-foreground">
                  {selectedForActions.length} checkpoint{selectedForActions.length !== 1 ? 's' : ''} selected
                </Text>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={handleClearSelection}
                  className="h-8">
                  <Text className="text-xs text-muted-foreground">Clear</Text>
                </Button>
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">
                {selectedForActions.length === 2
                  ? 'Ready to compare'
                  : 'Select 2 checkpoints to compare'}
              </Text>
              <View className="mt-2 flex-row gap-2">
                <Button
                  size="sm"
                  onPress={handleCompare}
                  disabled={selectedForActions.length !== 2}
                  className="flex-1">
                  <View className="flex-row items-center justify-center gap-1">
                    <Icon as={ArrowRightLeft} size={14} className="text-primary-foreground" />
                    <Text className="text-xs text-primary-foreground">Compare</Text>
                  </View>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onPress={handleDeleteSelected}
                  disabled={selectedForActions.length === 0}
                  className="flex-1">
                  <Text className="text-xs text-destructive-foreground">Delete</Text>
                </Button>
              </View>
            </View>
          )}

          {/* Hint banner when not in selection mode */}
          {!isSelectionMode && selectedForActions.length === 0 && checkpoints.length >= 2 && (
            <View className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <View className="flex-row items-start gap-2">
                <Icon as={Info} size={16} className="text-primary mt-0.5" />
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-sm font-medium text-foreground">
                      Compare checkpoints
                    </Text>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => setIsSelectionMode(true)}
                      className="h-7">
                      <Text className="text-xs text-foreground">Compare</Text>
                    </Button>
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    Select two checkpoints to compare photos. Long-press a checkpoint to select.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {(checkpointLimitHint || checkpointLimitMessage) && !isSelectionMode ? (
            <Text
              className={`mb-3 text-sm ${
                checkpointLimitMessage ? 'text-destructive' : 'text-muted-foreground'
              }`}>
              {checkpointLimitMessage ?? checkpointLimitHint}
            </Text>
          ) : null}

          <FlatList
            data={filteredCheckpoints}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CheckpointCard
                checkpoint={item}
                onPress={handleCheckpointPress}
                onLongPress={handleCheckpointLongPress}
                selectionMode={isSelectionMode}
                isSelected={selectedForActions.includes(item.id)}
                isDeleting={isCheckpointDeletingOverlay(item)}
                isDeleteFailed={isResourceDeletionFailed(item)}
                onRetryDelete={handleRetryDeleteCheckpoint}
              />
            )}
            contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            ListFooterComponent={
              hasMoreCheckpoints ? (
                <View className="py-4">
                  <Button
                    variant="outline"
                    onPress={loadMoreCheckpoints}
                    disabled={isLoadingEarlier}
                    className="w-full">
                    <Text className="text-foreground">
                      {isLoadingEarlier ? 'Loading...' : 'Load More Checkpoints'}
                    </Text>
                  </Button>
                </View>
              ) : checkpoints.length > CHECKPOINT_PAGE_SIZE ? (
                <View className="py-4">
                  <Text className="text-center text-sm text-muted-foreground">
                    No more checkpoints to load
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View className="rounded-lg border border-dashed border-border bg-secondary/30 p-4">
                <Text className="text-center text-sm text-muted-foreground">
                  No checkpoints match your current filters.
                </Text>
                {hasActiveFilters ? (
                  <Button variant="link" onPress={clearCheckpointFilters} className="mt-1 h-8 self-center">
                    <Text className="text-primary">Reset filters</Text>
                  </Button>
                ) : null}
              </View>
            }
          />
        </View>
      )}

      {/* Insights Sub-tab Content */}
      {activeSubTab === 'insights' && (
        <ScrollView className="flex-1 p-4">
          <PropertyMetricsCard
            checkpoints={checkpoints}
            onOpenIssues={() => setIsIssuesModalVisible(true)}
          />
        </ScrollView>
      )}

      {activeSubTab === 'reports' && (
        <PropertyReportsSegment
          generateModalVisible={isGenerateReportModalVisible}
          onGenerateModalVisibleChange={setIsGenerateReportModalVisible}
        />
      )}

      <CreateCheckpointModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onCreate={handleCreateCheckpoint}
      />

      <CheckpointDetailModal
        visible={isDetailModalVisible}
        checkpoint={selectedCheckpoint ? checkpoints.find(cp => cp.id === selectedCheckpoint.id) || selectedCheckpoint : null}
        onClose={() => setIsDetailModalVisible(false)}

      />

      {/* Issues breakdown modal */}
      <Modal visible={isIssuesModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-foreground">Issues breakdown</Text>
              <Text className="text-xs text-muted-foreground">From recent checkpoints</Text>
            </View>
            <Button onPress={() => setIsIssuesModalVisible(false)} variant="ghost" size="icon">
              <Icon as={X} size={22} className="text-foreground" />
            </Button>
          </View>

          <ScrollView className="flex-1">
            <View className="p-4">
              <View className="mb-3 flex-row flex-wrap gap-2">
                {(['all', 'critical', 'major', 'moderate', 'minor'] as const).map((sev) => (
                  <Pressable
                    key={sev}
                    onPress={() => setIssuesFilter(sev)}
                    className={`rounded-full border px-2 py-0.5 ${
                      issuesFilter === sev
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}>
                    <Text
                      className={`text-xs ${issuesFilter === sev ? 'text-primary' : 'text-foreground'}`}>
                      {sev === 'all' ? 'All' : severityLabel(sev)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {(() => {
                const fromSummary: IssueRow[] = (propertyMetrics?.issues?.recent ?? []).map(
                  (r: PropertyCheckpointIssueRow) => ({
                    severity: r.severity,
                    description: r.description,
                    checkpointId: r.checkpointId,
                    checkpointName: r.checkpointName,
                    createdAt: new Date(r.createdAt),
                  })
                );
                const rows =
                  fromSummary.length > 0
                    ? fromSummary
                    : normalizeIssuesFromCheckpoints(checkpoints, 12);
                const filtered =
                  issuesFilter === 'all' ? rows : rows.filter((r) => r.severity === issuesFilter);
                if (filtered.length === 0) {
                  return (
                    <Text className="text-sm text-muted-foreground">
                      No issues found in the recent checkpoints.
                    </Text>
                  );
                }
                return (
                  <View className="gap-3">
                    {filtered.slice(0, 50).map((r, idx) => (
                      <View
                        key={`${r.checkpointId}-${idx}`}
                        className="rounded-lg border border-border bg-card p-3">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-xs text-muted-foreground">
                            {severityLabel(r.severity)}
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            {format(r.createdAt, 'MMM d, yyyy')}
                          </Text>
                        </View>
                        <Text className="mt-1 text-sm font-medium text-foreground">
                          {r.description}
                        </Text>
                        <Text className="mt-1 text-xs text-muted-foreground">
                          From: {r.checkpointName}
                        </Text>
                      </View>
                    ))}
                    {rows.length > 50 && (
                      <Text className="text-xs text-muted-foreground">
                        Showing the first 50 issues.
                      </Text>
                    )}
                  </View>
                );
              })()}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={filterModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-foreground">Filter checkpoints</Text>
              <Text className="text-xs text-muted-foreground">Narrow by location</Text>
            </View>
            <Button onPress={() => setFilterModalVisible(false)} variant="ghost" size="icon">
              <Icon as={X} size={22} className="text-foreground" />
            </Button>
          </View>

          <ScrollView className="flex-1 p-4">
            <Text className="mb-2 text-sm font-medium text-foreground">Location</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              <Pressable
                onPress={() => {
                  setLocationFilter('all');
                  setFilterModalVisible(false);
                }}
                className={`rounded-full border px-3 py-1.5 ${
                  locationFilter === 'all' ? 'border-primary bg-primary/10' : 'border-border bg-card'
                }`}>
                <Text className={`text-xs ${locationFilter === 'all' ? 'text-primary' : 'text-foreground'}`}>
                  All locations
                </Text>
              </Pressable>
              {locationOptions.map((location) => (
                <Pressable
                  key={location}
                  onPress={() => {
                    setLocationFilter(location);
                    setFilterModalVisible(false);
                  }}
                  className={`rounded-full border px-3 py-1.5 ${
                    locationFilter === location ? 'border-primary bg-primary/10' : 'border-border bg-card'
                  }`}>
                  <Text className={`text-xs ${locationFilter === location ? 'text-primary' : 'text-foreground'}`}>
                    {location}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button
              variant="outline"
              onPress={() => {
                clearCheckpointFilters();
                setFilterModalVisible(false);
              }}
              className="w-full">
              <Text className="text-foreground">Clear all filters</Text>
            </Button>
          </ScrollView>
        </View>
      </Modal>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Checkpoints</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedForActions.length} checkpoint
              {selectedForActions.length !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onPress={confirmDelete}>
              <Text>Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      </View>
    );
  }

  // Return content with modals always rendered (prevents blank screen during transitions)
  return (
    <>
      {content}
      
      {/* Modals - Always rendered to prevent blank screen when transitioning from empty to populated state */}
      <CreateCheckpointModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onCreate={handleCreateCheckpoint}
      />
      
      <CheckpointProcessingModal
        visible={isProcessingModalVisible}
        checkpointId={newCheckpointId}
        checkpointName={newCheckpointName}
        onViewCheckpoint={handleViewNewCheckpoint}
        onContinue={handleContinueFromProcessing}
      />
      
      <CheckpointComparisonModal
        visible={isComparisonModalVisible}
        checkpoint1={checkpoints.find((c) => c.id === selectedForActions[0]) || null}
        checkpoint2={checkpoints.find((c) => c.id === selectedForActions[1]) || null}
        onClose={() => setIsComparisonModalVisible(false)}
      />

    </>
  );
}
