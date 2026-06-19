'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { usePreferences } from '@/contexts/preferences-context';
import { Separator } from '@/components/ui/separator';
import { Info, Camera } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function CheckpointSettings() {
  const { preferences, loading, updatePreferences } = usePreferences();

  const comparisonPrefs = preferences?.checkpointComparison || {
    enabled: true,
    maxAgeDays: 180,
    minAssetConfidence: 0.3,
  };

  const handleEnabledChange = (enabled: boolean) => {
    updatePreferences({
      checkpointComparison: {
        ...comparisonPrefs,
        enabled,
      },
    });
  };

  const handleMaxAgeDaysChange = (value: number[]) => {
    updatePreferences({
      checkpointComparison: {
        ...comparisonPrefs,
        maxAgeDays: value[0],
      },
    });
  };

  const handleMinAssetConfidenceChange = (value: number[]) => {
    updatePreferences({
      checkpointComparison: {
        ...comparisonPrefs,
        minAssetConfidence: value[0] / 100,
      },
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Checkpoint Comparison
          </CardTitle>
          <CardDescription>
            Automatically compare new checkpoints with previous ones from the same location to detect changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Checkpoint Comparison
        </CardTitle>
        <CardDescription>
          Automatically compare new checkpoints with previous ones from the same location to detect changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="enabled">Enable Automatic Comparison</Label>
            <p className="text-sm text-muted-foreground">
              Automatically detect changes when creating checkpoints
            </p>
          </div>
          <Switch
            id="enabled"
            checked={comparisonPrefs.enabled}
            onCheckedChange={handleEnabledChange}
            className="shrink-0 self-start sm:self-center"
          />
        </div>

        <Separator />

        {/* Max Age Days */}
        <div className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 space-y-0.5">
              <Label>Maximum Age (Days)</Label>
              <p className="text-sm text-muted-foreground">
                Only compare with checkpoints from the last {comparisonPrefs.maxAgeDays} days
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium">{comparisonPrefs.maxAgeDays} days</span>
          </div>
          <Slider
            value={[comparisonPrefs.maxAgeDays]}
            onValueChange={handleMaxAgeDaysChange}
            min={30}
            max={365}
            step={30}
            disabled={!comparisonPrefs.enabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>30 days</span>
            <span>365 days</span>
          </div>
        </div>

        <Separator />

        {/* Min Asset Confidence */}
        <div className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 space-y-0.5">
              <Label>Minimum Asset Confidence</Label>
              <p className="text-sm text-muted-foreground">
                Only compare when asset detection confidence is at least {Math.round(comparisonPrefs.minAssetConfidence * 100)}%
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium">
              {Math.round(comparisonPrefs.minAssetConfidence * 100)}%
            </span>
          </div>
          <Slider
            value={[Math.round(comparisonPrefs.minAssetConfidence * 100)]}
            onValueChange={handleMinAssetConfidenceChange}
            min={0}
            max={100}
            step={10}
            disabled={!comparisonPrefs.enabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Info Box */}
        <div className="flex gap-3 rounded-lg border bg-muted/50 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            These settings apply to all future checkpoints. Changes won&apos;t affect existing comparisons.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

