import { Tabs } from 'expo-router';
import { Home, FileText, Briefcase, Settings } from 'lucide-react-native';
import { Icon } from '../../components/ui/icon';
import { Text } from '../../components/ui/text';
import { View } from 'react-native';
import AppHeader from '../../components/AppHeader';
import { useColorScheme } from 'nativewind';
import { NAV_THEME, THEME } from '@/lib/theme';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();

  const activeColor = NAV_THEME[colorScheme ?? 'dark'].colors.primary;
  const inactiveColor = THEME[colorScheme ?? 'dark'].mutedForeground;
  const tabBarBg = NAV_THEME[colorScheme ?? 'dark'].colors.card;
  const borderTopColor = NAV_THEME[colorScheme ?? 'dark'].colors.border;

  return (
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
          header: () => <AppHeader />,
          headerShown: true,
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <View className="w-full items-center justify-center">
              <Icon as={Settings} color={color} size={24} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
