import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { Icon } from '@//components/ui/icon';
import { Text } from '@//components/ui/text';
import { Button } from '@//components/ui/button';
import { BookOpen, SunIcon, MoonStarIcon } from 'lucide-react-native';
import { AssetMemBrandIcon } from '@/components/AssetMemBrandIcon';
import { useColorScheme } from 'nativewind';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
import { UserProfileAvatar } from '@/components/UserProfileAvatar';
import { TokenUsageBar } from '@/components/TokenUsageBar';
import { ThemePreference } from '@homeapp/common/types';
import {
  navigateToSettingsSubScreen,
  resolveAppHeaderReturnContext,
} from '@/lib/settings-navigation';
import { NotificationsBell } from '@/components/NotificationsBell';

function ThemeToggle() {
  const { user } = useAuth();
  const { updatePreferences } = usePreferences();
  const { colorScheme, setColorScheme } = useColorScheme();

  const handleToggle = () => {
    const next: ThemePreference = colorScheme === 'dark' ? 'light' : 'dark';
    setColorScheme(next);
    if (user) {
      void updatePreferences({ theme: next });
    }
  };

  return (
    <Button
      onPressIn={handleToggle}
      size="icon"
      variant="ghost"
      className="h-8 w-8 min-w-8 rounded-full p-0 web:mx-2"
      accessibilityLabel="Light / dark mode">
      <Icon as={colorScheme === 'light' ? MoonStarIcon : SunIcon} className="size-4" />
    </Button>
  );
}

export default function AppHeader() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const returnContext = resolveAppHeaderReturnContext(segments);

  const openAccountSettings = () => {
    navigateToSettingsSubScreen(router, 'account', returnContext);
  };

  const openFaq = () => {
    navigateToSettingsSubScreen(router, 'faq', returnContext);
  };

  return (
    <View
      className="flex-row items-center justify-between bg-card px-3 pb-3 shadow-sm"
      style={{ paddingTop: insets.top + 12 }}>
      <View className="min-w-0 flex-1 flex-row items-center gap-1.5 pr-2">
        <AssetMemBrandIcon size="sm" className="shrink-0" />
        <Text className="shrink-0 text-lg font-bold leading-normal text-foreground">
          AssetMem AI
        </Text>
      </View>
      <View className="shrink-0 flex-row items-center gap-px">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 min-w-8 p-0"
          onPress={openFaq}
          accessibilityLabel="FAQ & guides"
          accessibilityRole="button">
          <Icon as={BookOpen} size={20} className="text-muted-foreground" />
        </Button>
        <TokenUsageBar settingsReturnContext={returnContext} />
        <NotificationsBell />
        {user ? (
          <Button
            variant="ghost"
            size="icon"
            className="ml-0.5 h-8 w-8 min-w-8 rounded-full p-0"
            onPress={openAccountSettings}
            accessibilityLabel="Account"
            accessibilityRole="button">
            <UserProfileAvatar
              user={user}
              className="size-8"
              fallbackTextClassName="text-xs"
            />
          </Button>
        ) : (
          <View className="ml-0.5 size-8 rounded-full bg-secondary" />
        )}
      </View>
    </View>
  );
}
