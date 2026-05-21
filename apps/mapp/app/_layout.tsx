import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';
import * as React from 'react';
import { FirebaseProvider } from '@homeapp/common/contexts/firebase-context';
import { AuthProvider, useAuth } from '@homeapp/common/contexts/auth-context';
import { PropertiesListProvider } from '@homeapp/common/contexts/properties-list-context';
import { SessionProvider } from '@homeapp/common/contexts/session-context';
import { DocumentUploadProvider } from '@homeapp/common/contexts/document-upload-context';
import { PreferencesProvider } from '@homeapp/common/contexts/preferences-context';
import { app, auth, db, storage } from '@homeapp/common/firebase';
import { createAgentSession } from '@/lib/api';
import { MappLlmTokenUsageProvider } from '@/components/MappLlmTokenUsageProvider';
import { ThemePreferenceSync } from '@/components/ThemePreferenceSync';
import { createLogger } from '@/lib/logger';

const routesLog = createLogger('routes');

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <ThemeProvider value={NAV_THEME[colorScheme ?? 'dark']}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <FirebaseProvider app={app} auth={auth} db={db} storage={storage}>
        <AuthProvider>
          <PreferencesProvider>
            <ThemePreferenceSync />
            <MappLlmTokenUsageProvider>
              <SessionProvider createAgentSession={createAgentSession}>
                <PropertiesListProvider>
                  <DocumentUploadProvider>
                    <Routes />
                  </DocumentUploadProvider>
                </PropertiesListProvider>
              </SessionProvider>
            </MappLlmTokenUsageProvider>
          </PreferencesProvider>
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
  const router = useRouter();
  const segments = useSegments();

  React.useEffect(() => {
    routesLog.debug('auth.state', { isSignedIn, isLoaded, loading });
    if (isLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoaded, loading, isSignedIn]);

  // Handle navigation based on auth state
  React.useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === 'auth';
    const isAtRoot = segments.length === 0 || segments[0] === 'index' || !segments[0];

    routesLog.debug('navigation.check', {
      isSignedIn,
      inAuthGroup,
      isAtRoot,
      segments,
    });

    // Allow landing page (root) to be accessible to everyone
    if (isAtRoot) {
      return;
    }

    if (isSignedIn && inAuthGroup) {
      routesLog.debug('navigation.redirect', { target: '/(tabs)/home' });
      router.replace('/(tabs)/home');
    } else if (!isSignedIn && !inAuthGroup && !isAtRoot) {
      routesLog.debug('navigation.redirect', { target: '/' });
      router.replace('/');
    }
  }, [isSignedIn, isLoaded, segments, router]);

  if (!isLoaded) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
