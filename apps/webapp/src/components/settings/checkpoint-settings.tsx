'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { usePreferences } from '@/contexts/preferences-context';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';

export function CheckpointSettings() {
  const { preferences, updatePreferences } = usePreferences();

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checkpoint Comparison Settings</CardTitle>
        <CardDescription>
          Control how automatic checkpoint comparisons work
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enabled">Enable Automatic Comparison</Label>
            <p className="text-sm text-muted-foreground">
              Automatically compare new checkpoints with previous ones
            </p>
          </div>
          <Switch
            id="enabled"
            checked={comparisonPrefs.enabled}
            onCheckedChange={handleEnabledChange}
          />
        </div>

        <Separator />

        {/* Max Age Days */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <Label>Maximum Age (Days)</Label>
              <p className="text-sm text-muted-foreground">
                Only compare with checkpoints from the last N days
              </p>
            </div>
            <span className="text-sm font-medium">{comparisonPrefs.maxAgeDays} days</span>
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

        {/* Min Room Confidence */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <Label>Minimum Room Confidence</Label>
              <p className="text-sm text-muted-foreground">
                Only auto-compare if room detection confidence is above this threshold
              </p>
            </div>
            <span className="text-sm font-medium">
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
        <div className="flex gap-3 rounded-lg border bg-muted p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How it works:</p>
            <p className="mt-1">
              When you create a new checkpoint, the system will automatically find and compare it
              with the most recent checkpoint from the same location (if it meets your criteria).
              This helps track changes over time without manual effort.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

