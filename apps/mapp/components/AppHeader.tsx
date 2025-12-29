import React from 'react';
import { View } from 'react-native';
import { Icon } from '@//components/ui/icon';
import { Text } from '@//components/ui/text';
import { Button } from '@//components/ui/button';
import { Home, Bell, SunIcon, MoonStarIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { User } from 'firebase/auth';

const THEME_ICONS = {
  light: SunIcon,
  dark: MoonStarIcon,
};

function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <Button
      onPressIn={toggleColorScheme}
      size="icon"
      variant="ghost"
      className="ios:size-9 rounded-full web:mx-4">
      <Icon as={colorScheme === 'light' ? MoonStarIcon : SunIcon} className="size-5" />
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
    <View className="flex-row items-center justify-between bg-card p-4 pt-12 shadow-sm">
      <View className="flex-row items-center gap-2">
        <Icon as={Home} size={24} className="text-foreground" />
        <Text className="text-xl font-bold text-foreground">HomeGeek AI</Text>
      </View>
      <View className="flex-row items-center gap-4">
        <ThemeToggle />
        <Button variant="ghost" size="icon">
          <Icon as={Bell} size={24} className="text-muted-foreground" />
        </Button>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
          <Text className="text-sm font-semibold text-secondary-foreground">
            {loading ? '' : userInitials}
          </Text>
        </View>
      </View>
    </View>
  );
}
