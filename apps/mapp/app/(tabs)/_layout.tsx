import { Tabs } from 'expo-router';
import { Home, Settings } from 'lucide-react-native';
import { Icon } from '../../components/ui/icon';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { NAV_THEME, THEME } from '@/lib/theme';

const TAB_BAR_PADDING_TOP = 10;
const TAB_BAR_PADDING_BOTTOM = 20;
const TAB_BAR_CONTENT_HEIGHT = 60;

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  // edgeToEdgeEnabled draws behind the Android nav bar; iOS tab bar insets are handled by the system.
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;
  const tabBarPaddingBottom = TAB_BAR_PADDING_BOTTOM + bottomInset;
  const tabBarHeight =
    TAB_BAR_PADDING_TOP + TAB_BAR_CONTENT_HEIGHT + tabBarPaddingBottom;

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
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: TAB_BAR_PADDING_TOP,
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
