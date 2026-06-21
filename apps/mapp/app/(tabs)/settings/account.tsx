import { SettingsSubScreen } from '@/components/settings/SettingsSubScreen';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { AccountDeletionSettings } from '@/components/settings/AccountDeletionSettings';

export default function SettingsAccountScreen() {
  return (
    <SettingsSubScreen title="Account">
      <ProfileSettings />
      <AccountDeletionSettings />
    </SettingsSubScreen>
  );
}
