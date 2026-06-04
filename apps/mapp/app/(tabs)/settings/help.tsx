import { SettingsSubScreen } from '@/components/settings/SettingsSubScreen';
import { SupportSettings } from '@/components/settings/SupportSettings';
import { LegalSettings } from '@/components/settings/LegalSettings';

export default function SettingsHelpScreen() {
  return (
    <SettingsSubScreen title="Help & support">
      <SupportSettings />
      <LegalSettings />
    </SettingsSubScreen>
  );
}
