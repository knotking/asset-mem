import LandingPage from './landing';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    console.log('[ROOT INDEX] Auth state:', { user: user?.email || 'none', loading });
  }, [user, loading]);

  console.log('[ROOT INDEX] Rendering - loading:', loading, 'user:', user?.email || 'none');

  // Show landing page for all users (logged-in users will see "Dashboard" button)
  // The landing page handles showing appropriate CTAs based on auth state
  if (loading) {
    console.log('[ROOT INDEX] Still loading, showing spinner');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' }}>
        <ActivityIndicator size="large" color="#22d3ee" />
      </View>
    );
  }

  return <LandingPage />;
}
