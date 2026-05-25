import { PlanBillingSettings } from '@/components/settings/PlanBillingSettings';
import { SettingsSubScreen } from '@/components/settings/SettingsSubScreen';

export default function SettingsBillingScreen() {
  return (
    <SettingsSubScreen title="Plan & billing">
      <PlanBillingSettings />
    </SettingsSubScreen>
  );
}
