import LandingPage from './landing';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { createLogger } from '@/lib/logger';

const routesLog = createLogger('routes');

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    routesLog.debug('index.auth', { isSignedIn: !!user, loading });
  }, [user, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' }}>
        <ActivityIndicator size="large" color="#22d3ee" />
      </View>
    );
  }

  return <LandingPage />;
}
