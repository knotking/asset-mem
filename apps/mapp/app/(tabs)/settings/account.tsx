import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { SettingsSubScreen } from '@/components/settings/SettingsSubScreen';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { AccountDeletionSettings } from '@/components/settings/AccountDeletionSettings';
import { createLogger } from '@/lib/logger';

const authLog = createLogger('auth');

export default function SettingsAccountScreen() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await logout();
      router.replace('/');
    } catch (error) {
      authLog.error('signOut.failed', undefined, error);
    }
  };

  return (
    <SettingsSubScreen title="Account">
      <ProfileSettings />

      <AccountDeletionSettings />

      <Button
        className="border border-destructive bg-card"
        onPress={() => void handleSignOut()}>
        <Icon as={LogOut} size={20} className="mr-2 text-destructive" />
        <Text className="font-semibold text-destructive">Sign Out</Text>
      </Button>
    </SettingsSubScreen>
  );
}
