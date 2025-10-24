import { Tabs, usePathname } from 'expo-router';
import { Home, FileText, Briefcase, Settings } from 'lucide-react-native';
import { Icon } from '../../components/ui/icon';
import { Text } from '../../components/ui/text';
import { View } from 'react-native';
import AppHeader from '../../components/AppHeader';
import { useColorScheme } from 'nativewind';
import { NAV_THEME, THEME } from '@/lib/theme';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const pathname = usePathname();
  const activeColor = NAV_THEME[colorScheme ?? 'light'].colors.primary;
  const inactiveColor = THEME[colorScheme ?? 'light'].mutedForeground;
  const tabBarBg = NAV_THEME[colorScheme ?? 'light'].colors.card;
  const borderTopColor = NAV_THEME[colorScheme ?? 'light'].colors.border;

  // Hide AppHeader on property details page
  const shouldShowAppHeader = !pathname.includes('property-details');

  return (
    <View className="flex-1 bg-background">
      {shouldShowAppHeader && <AppHeader />}
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: activeColor,
          tabBarInactiveTintColor: inactiveColor,
          headerShown: false,
          tabBarShowLabel: true,
          tabBarStyle: {
            backgroundColor: tabBarBg,
            borderTopWidth: 1,
            borderTopColor: borderTopColor,
            height: 90,
            paddingBottom: 20,
            paddingTop: 10,
          },
          tabBarLabelStyle: {
            fontSize: 12,
          },
        }}>
        <Tabs.Screen
          name="home"
          options={{
            title: 'Properties',
            tabBarIcon: ({ color }) => (
              <View className="w-full items-center justify-center">
                <Icon as={Home} color={color} size={24} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => (
              <View className="w-full items-center justify-center">
                <Icon as={Settings} color={color} size={24} />
              </View>
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
