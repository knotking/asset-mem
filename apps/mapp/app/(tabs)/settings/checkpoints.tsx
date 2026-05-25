import { CheckpointComparisonSettings } from '@/components/settings/CheckpointComparisonSettings';
import { SettingsSubScreen } from '@/components/settings/SettingsSubScreen';

export default function SettingsCheckpointsScreen() {
  return (
    <SettingsSubScreen title="Checkpoints">
      <CheckpointComparisonSettings />
    </SettingsSubScreen>
  );
}
