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
          <PreferencesProvider>
            <SessionProvider createAgentSession={createAgentSession}>
              <PropertiesListProvider>
                <DocumentUploadProvider>
                  <Routes />
                </DocumentUploadProvider>
              </PropertiesListProvider>
            </SessionProvider>
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
    console.log('[ROUTES] Auth state changed:', {
      user: user?.email || 'none',
      loading,
      isSignedIn,
      isLoaded,
    });
    if (isLoaded) {
      console.log('[ROUTES] Hiding splash screen');
      SplashScreen.hideAsync();
    }
  }, [isLoaded, user, loading, isSignedIn]);

  // Handle navigation based on auth state
  React.useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === 'auth';
    const inTabsGroup = segments[0] === '(tabs)';
    const isAtRoot = segments.length === 0 || segments[0] === 'index' || !segments[0];

    console.log('[ROUTES] Navigation check:', {
      isSignedIn,
      inAuthGroup,
      inTabsGroup,
      isAtRoot,
      segments,
    });

    // Allow landing page (root) to be accessible to everyone
    if (isAtRoot) {
      return; // Don't redirect, let landing page show
    }

    if (isSignedIn && inAuthGroup) {
      // User is signed in but in auth screens, redirect to tabs
      console.log('[ROUTES] Redirecting to /(tabs)/home');
      router.replace('/(tabs)/home');
    } else if (!isSignedIn && !inAuthGroup) {
      // User is not signed in but not in auth screens, redirect to login
      console.log('[ROUTES] Redirecting to /auth/login');
      router.replace('/auth/login');
    }
  }, [isSignedIn, isLoaded, segments, router]);

  console.log('[ROUTES] Rendering with:', { isSignedIn, isLoaded, loading });

  if (!isLoaded) {
    console.log('[ROUTES] Not loaded yet, returning null');
    return null;
  }

  console.log(
    '[ROUTES] Stack rendering - isSignedIn:',
    isSignedIn,
    '- Should show:',
    isSignedIn ? '(tabs)' : 'auth'
  );

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
