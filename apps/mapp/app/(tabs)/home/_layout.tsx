import { Stack } from 'expo-router';
import AppHeader from '../../../components/AppHeader';

export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        header: () => <AppHeader />,
        headerShown: true,
        animation: 'slide_from_right',
        animationDuration: 300,
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="property-details"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 300,
        }}
      />
    </Stack>
  );
}
