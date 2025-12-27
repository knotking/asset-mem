'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from 'lucide-react';
import { usePropertyCheckpointMetrics } from '@/hooks/usePropertyCheckpointMetrics';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PropertyMetricsCardProps {
  onViewIssues?: () => void;
}

export function PropertyMetricsCard({ onViewIssues }: PropertyMetricsCardProps) {
  const { metrics, loading } = usePropertyCheckpointMetrics();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  const latest = metrics.overall?.latest_score;
  const issues = metrics.issues?.total_by_severity;
  const trend = metrics.deterioration?.trend;

  const latestDisplay =
    typeof latest === 'number' && Number.isFinite(latest)
      ? Math.max(0, Math.min(100, latest))
      : null;

  const getConditionLabel = (score: number | null) => {
    if (score === null) return '—';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 40) return 'Needs Attention';
    return 'Poor';
  };

  const getConditionColor = (score: number | null) => {
    if (score === null) return 'text-gray-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getTrendIcon = () => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'deteriorating') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getTrendLabel = () => {
    if (trend === 'improving') return 'Improving';
    if (trend === 'deteriorating') return 'Deteriorating';
    if (trend === 'stable') return 'Stable';
    return 'Unknown';
  };

  const totalIssues =
    (issues?.critical || 0) +
    (issues?.major || 0) +
    (issues?.moderate || 0) +
    (issues?.minor || 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Property Insights</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-sm">
                  Property metrics are calculated from all checkpoint analyses. The condition
                  score ranges from 0-100, with higher scores indicating better condition.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Condition */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Condition</span>
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <span className="text-sm text-muted-foreground">{getTrendLabel()}</span>
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-bold ${getConditionColor(latestDisplay)}`}>
              {latestDisplay !== null ? Math.round(latestDisplay) : '—'}
            </span>
            <span className="text-lg text-muted-foreground">/ 100</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {getConditionLabel(latestDisplay)}
          </p>
        </div>

        {/* Issues Breakdown */}
        {totalIssues > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Issues by Severity</span>
              {onViewIssues && (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={onViewIssues}>
                  View All
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {issues?.critical ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-200">
                  <span className="text-sm text-red-900">Critical</span>
                  <Badge variant="destructive">{issues.critical}</Badge>
                </div>
              ) : null}
              {issues?.major ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 border border-orange-200">
                  <span className="text-sm text-orange-900">Major</span>
                  <Badge className="bg-orange-500 hover:bg-orange-600">{issues.major}</Badge>
                </div>
              ) : null}
              {issues?.moderate ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-yellow-50 border border-yellow-200">
                  <span className="text-sm text-yellow-900">Moderate</span>
                  <Badge className="bg-yellow-500 hover:bg-yellow-600">{issues.moderate}</Badge>
                </div>
              ) : null}
              {issues?.minor ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="text-sm text-blue-900">Minor</span>
                  <Badge variant="secondary">{issues.minor}</Badge>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

