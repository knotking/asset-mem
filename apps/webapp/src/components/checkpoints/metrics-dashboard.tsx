'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Activity } from 'lucide-react';
import { usePropertyCheckpointMetrics } from '@/hooks/use-property-checkpoint-metrics';
import { format } from 'date-fns';
import type { PropertyCheckpointMetrics } from '@/lib/types';

function toDate(value: PropertyCheckpointMetrics['updatedAt']): Date {
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return value ? new Date(value as unknown as Date) : new Date(0);
}

export function MetricsDashboard() {
  const { metrics, loading } = usePropertyCheckpointMetrics();

  if (loading) {
    return <MetricsDashboardSkeleton />;
  }

  if (!metrics || !metrics.overall) {
    return null;
  }

  const latestScore = metrics.overall.latest_score ?? 0;
  const trend = metrics.deterioration?.trend || 'unknown';
  const deteriorationRate = metrics.deterioration?.rate_points_per_day ?? 0;

  const getTrendIcon = () => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'deteriorating':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-blue-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Property Health Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Overall Condition */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Overall Condition</h3>
            <div className="flex items-end gap-3">
              <div className={`text-5xl font-bold ${getScoreColor(latestScore)}`}>
                {latestScore.toFixed(0)}
              </div>
              <div className="mb-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  {getTrendIcon()}
                  <span className={getTrendColor()}>
                    {trend.charAt(0).toUpperCase() + trend.slice(1)}
                  </span>
                </Badge>
                {deteriorationRate !== 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.abs(deteriorationRate).toFixed(2)} pts/day
                  </p>
                )}
              </div>
            </div>

            {/* Trend Chart (Mini) */}
            {metrics.overall.trend && metrics.overall.trend.length > 0 && (
              <div className="mt-4">
                <div className="flex h-16 items-end gap-1">
                  {metrics.overall.trend.slice(-12).map((point, idx) => {
                    const height = (point.score / 100) * 100;
                    return (
                      <div
                        key={idx}
                        className="flex-1 rounded-t bg-primary/20 hover:bg-primary/40 transition-colors"
                        style={{ height: `${height}%` }}
                        title={`${format(new Date(point.t), 'MMM dd')}: ${point.score.toFixed(0)}`}
                      />
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Trend over last {metrics.overall.trend.length} checkpoints
                </p>
              </div>
            )}
          </div>

          {/* Issues Breakdown */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Issues by Severity</h3>
            {metrics.issues ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium">Critical</span>
                  </div>
                  <Badge variant="destructive">
                    {metrics.issues.total_by_severity.critical}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">Major</span>
                  </div>
                  <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                    {metrics.issues.total_by_severity.major}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium">Moderate</span>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                    {metrics.issues.total_by_severity.moderate}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Minor</span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    {metrics.issues.total_by_severity.minor}
                  </Badge>
                </div>

                <div className="mt-4 rounded-lg border bg-muted p-3">
                  <p className="text-sm font-semibold">
                    Total Issues: {metrics.issues.total}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No issues data available</p>
            )}
          </div>
        </div>

        {/* Metadata */}
        {metrics.updatedAt && (
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
            Last updated: {format(
              toDate(metrics.updatedAt),
              'PPp'
            )}
            {metrics.window && (
              <> · Based on {metrics.window.checkpoints_considered} checkpoints</>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricsDashboardSkeleton() {
  return (
    <Card className="mb-6">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

