import { SettingsSubScreen } from '@/components/settings/SettingsSubScreen';
import { HelpHubSettings } from '@/components/feature-discovery/HelpHubSettings';

export default function SettingsFaqScreen() {
  return (
    <SettingsSubScreen title="FAQ">
      <HelpHubSettings />
    </SettingsSubScreen>
  );
}
