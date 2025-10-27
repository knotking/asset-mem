import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';
import * as React from 'react';
import { FirebaseProvider } from '@homeapp/common/contexts/firebase';
import { AuthProvider, useAuth } from '@homeapp/common/contexts/auth';
import { PropertiesListProvider } from '@homeapp/common/contexts/properties-list';
import { SessionProvider } from '@homeapp/common/contexts/session-context';
import { app, auth, db, storage } from '@homeapp/common/firebase';
import { createAgentSession } from '@/lib/api';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <FirebaseProvider app={app} auth={auth} db={db} storage={storage}>
        <AuthProvider>
          <SessionProvider createAgentSession={createAgentSession}>
            <PropertiesListProvider>
              <Routes />
            </PropertiesListProvider>
          </SessionProvider>
        </AuthProvider>
      </FirebaseProvider>
      <PortalHost />
    </ThemeProvider>
  );
}

function Routes() {
  const { user, loading } = useAuth();
  const isSignedIn = !!user;
  const isLoaded = !loading;

  React.useEffect(() => {
    if (isLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return null;
  }

  return (
    <Stack>
      {/* Screens only shown when the user is NOT signed in */}
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Screens only shown when the user IS signed in */}
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Screens outside the guards are accessible to everyone (e.g. not found) */}
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
