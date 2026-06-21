import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  navigateBackFromSettingsSubScreen,
  resolveSettingsReturnContext,
  settingsBackAccessibilityLabel,
} from '@/lib/settings-navigation';

type SettingsSubScreenProps = {
  title: string;
  children: React.ReactNode;
};

export function SettingsSubScreen({ title, children }: SettingsSubScreenProps) {
  const router = useRouter();
  const { returnTo, returnPropertyId, returnPropertyTab, returnSessionId } = useLocalSearchParams<{
    returnTo?: string | string[];
    returnPropertyId?: string | string[];
    returnPropertyTab?: string | string[];
    returnSessionId?: string | string[];
  }>();
  const returnContext = resolveSettingsReturnContext({
    returnTo,
    returnPropertyId,
    returnPropertyTab,
    returnSessionId,
  });

  const handleBack = () => {
    navigateBackFromSettingsSubScreen(router, returnContext);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center border-b border-border bg-card px-2 py-2">
        <Button
          onPress={handleBack}
          variant="ghost"
          size="icon"
          testID="settings-back"
          accessibilityLabel={settingsBackAccessibilityLabel(returnContext)}>
          <Icon as={ArrowLeft} size={22} className="text-foreground" />
        </Button>
        <Text className="flex-1 text-center text-lg font-semibold text-foreground" numberOfLines={1}>
          {title}
        </Text>
        <View className="w-10" />
      </View>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-8">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
