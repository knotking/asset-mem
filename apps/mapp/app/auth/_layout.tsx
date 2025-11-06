import { Stack } from 'expo-router';
import { useEffect } from 'react';

export default function AuthLayout() {
  useEffect(() => {
    console.log('[AUTH LAYOUT] Component mounted');
  }, []);

  console.log('[AUTH LAYOUT] Rendering Stack with index, login, signup');

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      {/* Add other auth-related screens here, e.g., signup, forgot-password */}
    </Stack>
  );
}
