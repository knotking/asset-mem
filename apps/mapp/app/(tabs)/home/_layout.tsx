import { Stack } from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
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
