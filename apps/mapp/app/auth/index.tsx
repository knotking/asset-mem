import { Redirect } from 'expo-router';
import { useEffect } from 'react';

export default function AuthIndex() {
  useEffect(() => {
    console.log('[AUTH INDEX] Component mounted - redirecting to /auth/login');
  }, []);

  console.log('[AUTH INDEX] Rendering redirect to /auth/login');
  return <Redirect href="/auth/login" />;
}
