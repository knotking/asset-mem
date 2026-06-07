import { Stack } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { SettingsTabFocusReset } from '@/components/settings/SettingsTabFocusReset';

export default function SettingsLayout() {
  return (
    <>
      <SettingsTabFocusReset />
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
      <Stack.Screen name="faq" />
      <Stack.Screen name="help" />
      <Stack.Screen name="billing" />
      <Stack.Screen name="usage" />
      <Stack.Screen name="checkpoints" />
    </Stack>
    </>
  );
}
