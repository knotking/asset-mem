import React from 'react';
import { View } from 'react-native';
import { Icon } from '@//components/ui/icon';
import { Text } from '@//components/ui/text';
import { Button } from '@//components/ui/button';
import { Bell, SunIcon, MoonStarIcon } from 'lucide-react-native';
import { AssetMemBrandIcon } from '@/components/AssetMemBrandIcon';
import { useColorScheme } from 'nativewind';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
import { UserProfileAvatar } from '@/components/UserProfileAvatar';
import { TokenUsageBar } from '@/components/TokenUsageBar';
import { ThemePreference } from '@homeapp/common/types';

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
      className="h-8 w-8 min-w-8 rounded-full p-0 web:mx-2">
      <Icon as={colorScheme === 'light' ? MoonStarIcon : SunIcon} className="size-4" />
    </Button>
  );
}

export default function AppHeader() {
  const { user } = useAuth();

  return (
    <View className="flex-row items-center justify-between bg-card px-3 py-3 pt-12 shadow-sm">
      <View className="min-w-0 flex-1 flex-row items-center gap-1.5 pr-2">
        <AssetMemBrandIcon size="sm" />
        <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
          AssetMem AI
        </Text>
      </View>
      <View className="shrink-0 flex-row items-center gap-px">
        <ThemeToggle />
        <TokenUsageBar />
        <Button variant="ghost" size="icon" className="h-8 w-8 min-w-8 p-0">
          <Icon as={Bell} size={20} className="text-muted-foreground" />
        </Button>
        {user ? (
          <UserProfileAvatar
            user={user}
            className="ml-0.5 size-8"
            fallbackTextClassName="text-xs"
          />
        ) : (
          <View className="ml-0.5 size-8 rounded-full bg-secondary" />
        )}
      </View>
    </View>
  );
}
