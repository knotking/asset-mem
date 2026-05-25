import { AiUsageSettings } from '@/components/settings/AiUsageSettings';
import { SettingsSubScreen } from '@/components/settings/SettingsSubScreen';

export default function SettingsUsageScreen() {
  return (
    <SettingsSubScreen title="AI usage">
      <AiUsageSettings />
    </SettingsSubScreen>
  );
}
