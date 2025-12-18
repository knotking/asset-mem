import * as React from 'react';
import { View, Switch } from 'react-native';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Camera, Info } from 'lucide-react-native';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
import { CheckpointComparisonPreferences } from '@homeapp/common/types';

const DEFAULT_PREFERENCES: CheckpointComparisonPreferences = {
  enabled: true,
  maxAgeDays: 180,
  minAssetConfidence: 0.3,
};

export function CheckpointComparisonSettings() {
  const { preferences, loading, updateCheckpointComparison } = usePreferences();

  const comparisonPrefs = preferences?.checkpointComparison || DEFAULT_PREFERENCES;

  const [localEnabled, setLocalEnabled] = React.useState(comparisonPrefs.enabled);
  const [localMaxAgeDays, setLocalMaxAgeDays] = React.useState(comparisonPrefs.maxAgeDays);
  const [localMinConfidence, setLocalMinConfidence] = React.useState(
    comparisonPrefs.minAssetConfidence
  );
  const [hasChanges, setHasChanges] = React.useState(false);

  React.useEffect(() => {
    setLocalEnabled(comparisonPrefs.enabled);
    setLocalMaxAgeDays(comparisonPrefs.maxAgeDays);
    setLocalMinConfidence(comparisonPrefs.minAssetConfidence);
    setHasChanges(false);
  }, [comparisonPrefs]);

  const handleSave = async () => {
    try {
      await updateCheckpointComparison({
        enabled: localEnabled,
        maxAgeDays: localMaxAgeDays,
        minAssetConfidence: localMinConfidence,
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  const handleToggleEnabled = (value: boolean) => {
    setLocalEnabled(value);
    setHasChanges(true);
  };

  const handleMaxAgeChange = (value: number) => {
    const clamped = Math.max(30, Math.min(365, value)); // 30-365 days
    setLocalMaxAgeDays(clamped);
    setHasChanges(true);
  };

  const handleConfidenceChange = (value: number) => {
    const clamped = Math.max(0, Math.min(1, value)); // 0-1
    setLocalMinConfidence(clamped);
    setHasChanges(true);
  };

  if (loading) {
    return (
      <Card className="p-4">
        <Text className="text-muted-foreground">Loading preferences...</Text>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <View className="mb-4 flex-row items-center gap-2">
        <Icon as={Camera} size={20} className="text-foreground" />
        <Text className="text-lg font-semibold text-foreground">Checkpoint Comparison</Text>
      </View>

      <Text className="mb-4 text-sm text-muted-foreground">
        Automatically compare new checkpoints with previous ones from the same location to detect
        changes.
      </Text>

      {/* Master Toggle */}
      <View className="mb-4 flex-row items-center justify-between rounded-lg border border-border bg-card p-3">
        <View className="flex-1">
          <Text className="font-medium text-foreground">Enable Automatic Comparison</Text>
          <Text className="text-xs text-muted-foreground">
            Automatically detect changes when creating checkpoints
          </Text>
        </View>
        <Switch
          value={localEnabled}
          onValueChange={handleToggleEnabled}
          trackColor={{ false: '#767577', true: '#3b82f6' }}
          thumbColor={localEnabled ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      {localEnabled && (
        <>
          {/* Max Age Setting */}
          <View className="mb-4 rounded-lg border border-border bg-card p-3">
            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="font-medium text-foreground">Maximum Age (Days)</Text>
                <Text className="text-xs text-muted-foreground">
                  Only compare with checkpoints from the last {localMaxAgeDays} days
                </Text>
              </View>
              <Text className="ml-2 text-lg font-semibold text-foreground">{localMaxAgeDays}</Text>
            </View>
            <View className="flex-row gap-2">
              <Button
                size="sm"
                variant="outline"
                onPress={() => handleMaxAgeChange(localMaxAgeDays - 30)}
                disabled={localMaxAgeDays <= 30}>
                <Text>-30</Text>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onPress={() => handleMaxAgeChange(localMaxAgeDays + 30)}
                disabled={localMaxAgeDays >= 365}>
                <Text>+30</Text>
              </Button>
            </View>
          </View>

          {/* Minimum Confidence Setting */}
          <View className="mb-4 rounded-lg border border-border bg-card p-3">
            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="font-medium text-foreground">Minimum Asset Confidence</Text>
                <Text className="text-xs text-muted-foreground">
                  Only compare when asset detection confidence is at least{' '}
                  {Math.round(localMinConfidence * 100)}%
                </Text>
              </View>
              <Text className="ml-2 text-lg font-semibold text-foreground">
                {Math.round(localMinConfidence * 100)}%
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Button
                size="sm"
                variant="outline"
                onPress={() => handleConfidenceChange(localMinConfidence - 0.1)}
                disabled={localMinConfidence <= 0}>
                <Text>-10%</Text>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onPress={() => handleConfidenceChange(localMinConfidence + 0.1)}
                disabled={localMinConfidence >= 1}>
                <Text>+10%</Text>
              </Button>
            </View>
          </View>
        </>
      )}

      {/* Save Button */}
      {hasChanges && (
        <Button onPress={handleSave} className="mt-2">
          <Text className="text-primary-foreground">Save Changes</Text>
        </Button>
      )}

      {/* Info */}
      <View className="mt-4 flex-row gap-2 rounded-lg bg-muted/50 p-3">
        <Icon as={Info} size={16} className="mt-0.5 text-muted-foreground" />
        <View className="flex-1">
          <Text className="text-xs text-muted-foreground">
            These settings apply to all future checkpoints. Changes won't affect existing
            comparisons.
          </Text>
        </View>
      </View>
    </Card>
  );
}
