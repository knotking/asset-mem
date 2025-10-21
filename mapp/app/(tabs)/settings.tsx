import { View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { User } from 'firebase/auth';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  ChevronRight,
  User as UserIcon,
  Lock,
  Bell,
  Moon,
  Globe,
  HelpCircle,
  FileText,
  Shield,
  Info,
  LogOut,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Switch } from 'react-native';
import { Button } from '@/components/ui/button';

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

export default function SettingsScreen() {
  const { user, isLoading, signOut } = useAuth();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const userInitials = getUserInitials(user);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Optionally, navigate to the login screen or show a success message
    } catch (error) {
      console.error('Error signing out:', error);
      // Optionally, show an error message to the user
    }
  };

  return (
    <View className="flex-1 bg-background">
      <View className="mb-4 bg-card p-4">
        <View className="flex-row items-center space-x-4">
          <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-secondary">
            <Text className="text-xl font-semibold text-secondary-foreground">
              {isLoading ? '' : userInitials}
            </Text>
          </View>
          <View className="ml-2 flex-1">
            <Text className="text-lg font-semibold text-foreground">
              {user?.displayName || 'Property Owner'}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {user?.email || 'owner@homegeek.ai'}
            </Text>
          </View>
        </View>
      </View>

      <Button
        className="mx-4 border border-destructive bg-card text-destructive-foreground hover:bg-destructive/90"
        onPress={handleSignOut}>
        <Icon as={LogOut} size={20} className="mr-2 text-destructive" />
        <Text className="font-semibold text-destructive">Sign Out</Text>
      </Button>
    </View>
  );
}
