import { Redirect } from 'expo-router';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    console.log('[ROOT INDEX] Auth state:', { user: user?.email || 'none', loading });
  }, [user, loading]);

  console.log('[ROOT INDEX] Rendering - loading:', loading, 'user:', user?.email || 'none');

  if (loading) {
    console.log('[ROOT INDEX] Still loading, showing spinner');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const redirectTo = user ? '/(tabs)/home' : '/auth/login';
  console.log('[ROOT INDEX] Redirecting to:', redirectTo);

  return <Redirect href={redirectTo} />;
}
