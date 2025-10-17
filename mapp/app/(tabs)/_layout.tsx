import { Tabs } from 'expo-router';
import { Home, FileText, Briefcase, Settings } from 'lucide-react-native';
import { Icon } from '../../components/ui/icon';
import { Text } from '../../components/ui/text';
import { View } from 'react-native';
import AppHeader from '../../components/AppHeader';

export default function TabLayout() {
  return (
    <View className="flex-1 bg-gray-50">
      <AppHeader />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#1E90FF',
          tabBarInactiveTintColor: '#A0A0A0',
          headerShown: false,
          tabBarShowLabel: true,
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E0E0E0',
            height: 90,
            paddingBottom: 20,
            paddingTop: 10,
          },
          tabBarLabelStyle: {
            fontSize: 12,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
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
