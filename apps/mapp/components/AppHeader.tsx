import React from 'react';
import { View } from 'react-native';
import { Icon } from '@//components/ui/icon';
import { Text } from '@//components/ui/text';
import { Button } from '@//components/ui/button';
import { Home, Bell, SunIcon, MoonStarIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { User } from 'firebase/auth';
import { TokenUsageBar } from '@/components/TokenUsageBar';

function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <Button
      onPressIn={toggleColorScheme}
      size="icon"
      variant="ghost"
      className="h-8 w-8 min-w-8 rounded-full p-0 web:mx-2">
      <Icon as={colorScheme === 'light' ? MoonStarIcon : SunIcon} className="size-4" />
    </Button>
  );
}

export default function AppHeader() {
  const { user, loading } = useAuth();

  const getUserInitials = (user: User | null) => {
    if (!user) return 'NA';
    if (user.displayName) {
      const names = user.displayName.split(' ');
      return names
        .map((n: string) => n[0])
        .join('')
        .toUpperCase();
    } else if (user.email) {
      return user.email[0].toUpperCase();
    }
    return 'NA';
  };

  const userInitials = getUserInitials(user);

  return (
    <View className="flex-row items-center justify-between bg-card px-3 py-3 pt-12 shadow-sm">
      <View className="min-w-0 flex-1 flex-row items-center gap-1.5 pr-2">
        <Icon as={Home} size={22} className="shrink-0 text-foreground" />
        <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
          HomeGeek AI
        </Text>
      </View>
      <View className="shrink-0 flex-row items-center gap-px">
        <ThemeToggle />
        <TokenUsageBar />
        <Button variant="ghost" size="icon" className="h-8 w-8 min-w-8 p-0">
          <Icon as={Bell} size={20} className="text-muted-foreground" />
        </Button>
        <View className="ml-0.5 h-8 w-8 items-center justify-center rounded-full bg-secondary">
          <Text className="text-xs font-semibold text-secondary-foreground">
            {loading ? '' : userInitials}
          </Text>
        </View>
      </View>
    </View>
  );
}
