import * as React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { User, LifeBuoy, CreditCard, Activity, Camera, BookOpen } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { AppVersionFooter } from '@/components/settings/AppVersionFooter';
import { SettingsHubRow } from '@/components/settings/SettingsHubRow';
import { useSettingsHubSummaries } from '@/components/settings/useSettingsHubSummaries';

export default function SettingsHubScreen() {
  const router = useRouter();
  const {
    accountSubtitle,
    helpSubtitle,
    faqSubtitle,
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
          onPress={() => router.navigate('/(tabs)/settings/account')}
        />
        <SettingsHubRow
          icon={CreditCard}
          title="Plan & billing"
          subtitle={billingSubtitle}
          onPress={() => router.navigate('/(tabs)/settings/billing')}
        />
        <SettingsHubRow
          icon={Activity}
          title="AI usage"
          subtitle={usageSubtitle}
          onPress={() => router.navigate('/(tabs)/settings/usage')}
        />
        <SettingsHubRow
          icon={Camera}
          title="Checkpoints"
          subtitle={checkpointsSubtitle}
          onPress={() => router.navigate('/(tabs)/settings/checkpoints')}
        />
        <SettingsHubRow
          icon={BookOpen}
          title="FAQ"
          subtitle={faqSubtitle}
          onPress={() => router.navigate('/(tabs)/settings/faq')}
        />
        <SettingsHubRow
          icon={LifeBuoy}
          title="Help & support"
          subtitle={helpSubtitle}
          onPress={() => router.navigate('/(tabs)/settings/help')}
        />
      </View>

      <AppVersionFooter />
    </ScrollView>
  );
}
