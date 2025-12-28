'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { usePreferences } from '@/contexts/preferences-context';
import { Skeleton } from '@/components/ui/skeleton';

export function CheckpointComparisonSettings() {
  const { preferences, loading, updateCheckpointComparisonPreferences } = usePreferences();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const prefs = preferences?.checkpointComparison || {
    enabled: true,
    maxAgeDays: 180,
    minAssetConfidence: 0.3,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checkpoint Comparison Settings</CardTitle>
        <CardDescription>
          Configure how automatic checkpoint comparisons work
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="comparison-enabled">Automatic Comparison</Label>
            <p className="text-sm text-muted-foreground">
              Automatically compare new checkpoints with previous ones from the same location
            </p>
          </div>
          <Switch
            id="comparison-enabled"
            checked={prefs.enabled}
            onCheckedChange={(checked) =>
              updateCheckpointComparisonPreferences({ enabled: checked })
            }
          />
        </div>

        {/* Max Age Days */}
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <div>
              <Label>Maximum Age for Comparison</Label>
              <p className="text-sm text-muted-foreground">
                Only compare with checkpoints from the last {prefs.maxAgeDays} days
              </p>
            </div>
            <span className="text-sm font-medium">{prefs.maxAgeDays} days</span>
          </div>
          <Slider
            value={[prefs.maxAgeDays]}
            onValueChange={([value]) =>
              updateCheckpointComparisonPreferences({ maxAgeDays: value })
            }
            min={30}
            max={365}
            step={30}
            disabled={!prefs.enabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>30 days</span>
            <span>365 days</span>
          </div>
        </div>

        {/* Min Room Confidence */}
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <div>
              <Label>Minimum Room Confidence</Label>
              <p className="text-sm text-muted-foreground">
                Only auto-compare if room detection confidence is at least {Math.round(prefs.minAssetConfidence * 100)}%
              </p>
            </div>
            <span className="text-sm font-medium">
              {Math.round(prefs.minAssetConfidence * 100)}%
            </span>
          </div>
          <Slider
            value={[prefs.minAssetConfidence]}
            onValueChange={([value]) =>
              updateCheckpointComparisonPreferences({ minAssetConfidence: value })
            }
            min={0}
            max={1}
            step={0.1}
            disabled={!prefs.enabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

