import { Stack } from 'expo-router';
import AppHeader from '@/components/AppHeader';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 300,
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          header: () => <AppHeader />,
        }}
      />
      <Stack.Screen name="account" />
      <Stack.Screen name="billing" />
      <Stack.Screen name="usage" />
      <Stack.Screen name="checkpoints" />
    </Stack>
  );
}
