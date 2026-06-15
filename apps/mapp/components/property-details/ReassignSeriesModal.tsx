import * as React from 'react';
import {
  Modal,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { X } from 'lucide-react-native';
import type { Checkpoint } from '@homeapp/common/types';
import { useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';
import {
  formatSeriesReassignTargetDescription,
  getDefaultSeriesReassignTargetId,
  getMergeSeriesGuidance,
  listSeriesReassignTargets,
} from '@homeapp/common/lib/checkpoint-series-grouping';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showThemedAlert } from '@/contexts/themed-alert-context';

type ReassignSeriesModalProps = {
  visible: boolean;
  checkpoint: Checkpoint | null;
  onClose: () => void;
};

const NEW_SERIES_KEY = '__new__';

export function ReassignSeriesModal({
  visible,
  checkpoint,
  onClose,
}: ReassignSeriesModalProps) {
  const insets = useSafeAreaInsets();
  const { checkpoints, reassignCheckpointSeries } = useCheckpoint();
  const [target, setTarget] = React.useState(NEW_SERIES_KEY);
  const [newLocation, setNewLocation] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const existingTargets = React.useMemo(
    () => (checkpoint ? listSeriesReassignTargets(checkpoints, checkpoint) : []),
    [checkpoints, checkpoint]
  );

  const guidance = React.useMemo(
    () => getMergeSeriesGuidance(existingTargets),
    [existingTargets]
  );

  React.useEffect(() => {
    if (!visible || !checkpoint) {
      return;
    }
    const defaultTarget = getDefaultSeriesReassignTargetId(existingTargets);
    setTarget(defaultTarget ?? NEW_SERIES_KEY);
    setNewLocation(checkpoint.location || '');
  }, [visible, checkpoint, existingTargets]);

  if (!checkpoint) {
    return null;
  }

  const canReassign = checkpoint.isLatestInSeries !== false;

  const resolveLocation = (): string => {
    if (target === NEW_SERIES_KEY) {
      return newLocation.trim();
    }
    const match = existingTargets.find((item) => item.seriesId === target);
    return (match?.location || '').trim();
  };

  const handleSave = async () => {
    const location = resolveLocation();
    if (!location) {
      showThemedAlert(
        'Location required',
        'Choose an existing monitoring point or enter a location name.'
      );
      return;
    }

    try {
      setIsSaving(true);
      const assignment = await reassignCheckpointSeries(checkpoint.id, location);
      showThemedAlert(
        'Captures merged',
        `This photo is now v${assignment.revisionNumber} in ${location}.`
      );
      onClose();
    } catch (error) {
      showThemedAlert(
        'Could not merge',
        error instanceof Error
          ? error.message
          : 'Only the latest capture in a series can be moved.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">Merge capture</Text>
          <Button variant="ghost" size="icon" onPress={onClose}>
            <Icon as={X} size={20} className="text-foreground" />
          </Button>
        </View>

        <ScrollView className="flex-1 px-4 py-4" keyboardShouldPersistTaps="handled">
          <Text className="mb-2 text-sm text-muted-foreground">
            Moving: <Text className="font-medium text-foreground">{checkpoint.name}</Text>
          </Text>

          {!canReassign ? (
            <Text className="text-sm text-muted-foreground">
              Only the latest capture in a series can be moved. Open a newer capture to
              merge, or delete newer captures first.
            </Text>
          ) : (
            <View className="gap-4">
              <View className="rounded-lg border border-border bg-muted/40 px-3 py-3">
                <Text className="text-sm text-muted-foreground">{guidance}</Text>
              </View>

              {existingTargets.length > 0 ? (
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Merge into</Text>
                  {existingTargets.map((item) => (
                    <Pressable
                      key={item.seriesId}
                      onPress={() => setTarget(item.seriesId)}
                      className={`rounded-lg border px-3 py-3 ${
                        target === item.seriesId ? 'border-primary bg-primary/10' : 'border-border'
                      }`}
                    >
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="flex-1 font-medium text-foreground">{item.label}</Text>
                        {item.isSuggestedMatch ? (
                          <View className="rounded-full bg-secondary px-2 py-0.5">
                            <Text className="text-[10px] font-medium text-foreground">
                              Suggested
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text className="text-xs text-muted-foreground">
                        {formatSeriesReassignTargetDescription(item)}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => setTarget(NEW_SERIES_KEY)}
                    className={`rounded-lg border px-3 py-3 ${
                      target === NEW_SERIES_KEY ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    <Text className="font-medium text-foreground">New monitoring point…</Text>
                  </Pressable>
                </View>
              ) : null}

              {target === NEW_SERIES_KEY || existingTargets.length === 0 ? (
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Monitoring point name</Text>
                  <TextInput
                    value={newLocation}
                    onChangeText={setNewLocation}
                    placeholder="e.g. Kitchen, Vehicle - Exterior"
                    editable={!isSaving}
                    className="rounded-lg border border-border bg-card px-3 py-3 text-foreground"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>

        <View
          className="flex-row gap-3 border-t border-border px-4 py-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Button variant="outline" className="flex-1" onPress={onClose} disabled={isSaving}>
            <Text>Cancel</Text>
          </Button>
          <Button className="flex-1" onPress={handleSave} disabled={!canReassign || isSaving}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text>Merge</Text>}
          </Button>
        </View>
      </View>
    </Modal>
  );
}
