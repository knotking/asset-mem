import { View, ScrollView } from 'react-native';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { LogOut } from 'lucide-react-native';
import * as React from 'react';
import { createLogger } from '@/lib/logger';

const authLog = createLogger('auth');
import { Button } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { CheckpointComparisonSettings } from '@/components/settings/CheckpointComparisonSettings';
import { AiUsageSettings } from '@/components/settings/AiUsageSettings';
import { PlanBillingSettings } from '@/components/settings/PlanBillingSettings';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { AccountDeletionSettings } from '@/components/settings/AccountDeletionSettings';
import { LegalSettings } from '@/components/settings/LegalSettings';
import { SupportSettings } from '@/components/settings/SupportSettings';

export default function SettingsScreen() {
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
    <ScrollView className="flex-1 bg-background">
      <View className="p-4">
        <ProfileSettings />

        <View className="mb-4">
          <PlanBillingSettings />
        </View>

        <View className="mb-4">
          <AiUsageSettings />
        </View>

        <View className="mb-4">
          <CheckpointComparisonSettings />
        </View>

        <View className="mb-4">
          <SupportSettings />
        </View>

        <LegalSettings />

        <AccountDeletionSettings />

        <Button
          className="mb-4 border border-destructive bg-card text-destructive-foreground hover:bg-destructive/90"
          onPress={handleSignOut}>
          <Icon as={LogOut} size={20} className="mr-2 text-destructive" />
          <Text className="font-semibold text-destructive">Sign Out</Text>
        </Button>

        <View className="items-center pb-8">
          <Text className="text-xs text-muted-foreground">
            Version {Constants.expoConfig?.version || '0.0.1'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
