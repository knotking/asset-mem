import * as React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { User, CreditCard, Activity, Camera } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { SettingsHubRow } from '@/components/settings/SettingsHubRow';
import { useSettingsHubSummaries } from '@/components/settings/useSettingsHubSummaries';

export default function SettingsHubScreen() {
  const router = useRouter();
  const {
    accountSubtitle,
    billingSubtitle,
    usageSubtitle,
    checkpointsSubtitle,
  } = useSettingsHubSummaries();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 pb-8">
      <Text className="mb-1 text-2xl font-bold text-foreground">Settings</Text>
      <Text className="mb-5 text-sm text-muted-foreground">
        Account, subscription, usage, and preferences
      </Text>

      <View className="gap-2">
        <SettingsHubRow
          icon={User}
          title="Account"
          subtitle={accountSubtitle}
          onPress={() => router.push('/(tabs)/settings/account')}
        />
        <SettingsHubRow
          icon={CreditCard}
          title="Plan & billing"
          subtitle={billingSubtitle}
          onPress={() => router.push('/(tabs)/settings/billing')}
        />
        <SettingsHubRow
          icon={Activity}
          title="AI usage"
          subtitle={usageSubtitle}
          onPress={() => router.push('/(tabs)/settings/usage')}
        />
        <SettingsHubRow
          icon={Camera}
          title="Checkpoints"
          subtitle={checkpointsSubtitle}
          onPress={() => router.push('/(tabs)/settings/checkpoints')}
        />
      </View>

      <View className="mt-8 items-center">
        <Text className="text-xs text-muted-foreground">
          Version {Constants.expoConfig?.version || '0.0.1'}
        </Text>
      </View>
    </ScrollView>
  );
}
