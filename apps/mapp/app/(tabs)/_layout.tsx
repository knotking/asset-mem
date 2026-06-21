import { Tabs } from 'expo-router';
import { Home, Settings } from 'lucide-react-native';
import { Icon } from '../../components/ui/icon';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { NAV_THEME, THEME } from '@/lib/theme';
import { tabBarStylePadding } from '@/lib/tab-bar-metrics';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;
  const tabBarPadding = tabBarStylePadding(bottomInset);

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
          ...tabBarPadding,
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
          headerShown: false,
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
