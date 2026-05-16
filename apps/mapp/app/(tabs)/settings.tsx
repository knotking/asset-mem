import { View, ScrollView } from 'react-native';
import { useAuth } from '@homeapp/common/contexts/auth-context';
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
import { createLogger } from '@/lib/logger';

const authLog = createLogger('auth');
import { Button } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { CheckpointComparisonSettings } from '@/components/settings/CheckpointComparisonSettings';
import { AiUsageSettings } from '@/components/settings/AiUsageSettings';

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
  const { user, loading, logout } = useAuth();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const router = useRouter();
  const userInitials = getUserInitials(user);

  const handleSignOut = async () => {
    try {
      await logout();
      // Redirect to landing page after logout
      router.replace('/');
    } catch (error) {
      authLog.error('signOut.failed', undefined, error);
      // Optionally, show an error message to the user
    }
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4">
        {/* User Profile Section */}
        <View className="mb-4 rounded-lg bg-card p-4">
          <View className="flex-row items-center space-x-4">
            <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-secondary">
              <Text className="text-xl font-semibold text-secondary-foreground">
                {loading ? '' : userInitials}
              </Text>
            </View>
            <View className="ml-2 flex-1">
              <Text className="text-lg font-semibold text-foreground">
                {user?.displayName || 'Property Owner'}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {user?.email || 'owner@assetmem.ai'}
              </Text>
            </View>
          </View>
        </View>

        {/* AI usage (shared @homeapp/common + Firestore llm_token_usage) */}
        <View className="mb-4">
          <AiUsageSettings />
        </View>

        {/* Checkpoint Comparison Settings */}
        <View className="mb-4">
          <CheckpointComparisonSettings />
        </View>

        {/* Sign Out Button */}
        <Button
          className="mb-4 border border-destructive bg-card text-destructive-foreground hover:bg-destructive/90"
          onPress={handleSignOut}>
          <Icon as={LogOut} size={20} className="mr-2 text-destructive" />
          <Text className="font-semibold text-destructive">Sign Out</Text>
        </Button>

        {/* Version */}
        <View className="items-center pb-8">
          <Text className="text-xs text-muted-foreground">
            Version {Constants.expoConfig?.version || '0.0.1'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
