import { PlanBillingSettings } from '@/components/settings/PlanBillingSettings';
import { SettingsSubScreen } from '@/components/settings/SettingsSubScreen';
import { planSettingsScreenTitle } from '@/lib/ios-billing-compliance';

export default function SettingsBillingScreen() {
  return (
    <SettingsSubScreen title={planSettingsScreenTitle()}>
      <PlanBillingSettings />
    </SettingsSubScreen>
  );
}
