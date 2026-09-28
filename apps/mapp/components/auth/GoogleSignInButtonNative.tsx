import * as React from 'react';
import { InteractionManager, Platform, View } from 'react-native';
import Constants from 'expo-constants';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, firebaseConfig } from '@asset-mem/common/firebase';
import { GoogleIcon } from '@/components/auth/GoogleIcon';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Loader2 } from 'lucide-react-native';
import { createLogger } from '@/lib/logger';
import type { GoogleSignInButtonProps } from './GoogleSignInButton';

const authLog = createLogger('auth');

const GOOGLE_AUTH_ERRORS: Record<string, string> = {
  'auth/account-exists-with-different-credential':
    'An account already exists with this email. Sign in with your original method.',
  'auth/invalid-credential': 'Google sign-in failed. Please try again.',
  'auth/operation-not-allowed': 'Google sign-in is not enabled for this app.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
};

function runWhenMounted(mountedRef: React.RefObject<boolean>, fn: () => void) {
  InteractionManager.runAfterInteractions(() => {
    if (mountedRef.current) {
      fn();
    }
  });
}

function getGoogleOAuthConfigError(): string | null {
  if (!firebaseConfig.webClientId?.trim()) {
    return 'Google sign-in is not configured for this build (webClientId).';
  }
  if (Platform.OS === 'ios' && !firebaseConfig.iosClientId?.trim()) {
    return 'Google sign-in is not configured for iOS (iosClientId). See apps/mapp/docs/GOOGLE_SIGN_IN.md.';
  }
  if (Platform.OS === 'android' && !firebaseConfig.androidClientId?.trim()) {
    return 'Google sign-in is not configured for Android (androidClientId). See apps/mapp/docs/GOOGLE_SIGN_IN.md.';
  }
  return null;
}

function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: firebaseConfig.webClientId,
    iosClientId: firebaseConfig.iosClientId,
    offlineAccess: false,
  });
}

/** Native Google Sign-In — only loaded in dev/production builds (not Expo Go). */
export function GoogleSignInButtonNative({
  disabled,
  onSuccess,
  onError,
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = React.useState(false);
  const mountedRef = React.useRef(false);
  const onSuccessRef = React.useRef(onSuccess);
  const onErrorRef = React.useRef(onError);

  React.useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  React.useEffect(() => {
    mountedRef.current = true;
    if (getGoogleOAuthConfigError() === null) {
      configureGoogleSignIn();
      authLog.debug('login.google.configured', {
        platform: Platform.OS,
        androidPackage: Constants.expoConfig?.android?.package,
      });
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setLoadingSafe = React.useCallback((value: boolean) => {
    if (mountedRef.current) {
      setLoading(value);
    }
  }, []);

  const handlePress = async () => {
    if (loading || disabled) return;
    const configError = getGoogleOAuthConfigError();
    if (configError) {
      runWhenMounted(mountedRef, () => onErrorRef.current(configError));
      return;
    }

    setLoadingSafe(true);
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const signInResult = await GoogleSignin.signIn();
      if (!isSuccessResponse(signInResult)) {
        setLoadingSafe(false);
        return;
      }

      let idToken = signInResult.data.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }
      if (!idToken) {
        runWhenMounted(mountedRef, () =>
          onErrorRef.current('Google sign-in did not return a token. Please try again.')
        );
        setLoadingSafe(false);
        return;
      }

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      authLog.debug('login.google.success');
      runWhenMounted(mountedRef, () => onSuccessRef.current());
    } catch (err: unknown) {
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) {
          setLoadingSafe(false);
          return;
        }
        if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          runWhenMounted(mountedRef, () =>
            onErrorRef.current('Google Play Services is not available on this device.')
          );
          setLoadingSafe(false);
          return;
        }
        if (err.code === statusCodes.IN_PROGRESS) {
          setLoadingSafe(false);
          return;
        }
        authLog.warn('login.google.nativeError', { code: err.code, message: err.message });
      }

      const firebaseCode =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : undefined;
      const message =
        (firebaseCode && GOOGLE_AUTH_ERRORS[firebaseCode]) ||
        (err instanceof Error ? err.message : null) ||
        'Google sign-in failed. Please try again.';
      runWhenMounted(mountedRef, () => onErrorRef.current(message));
    } finally {
      setLoadingSafe(false);
    }
  };

  return (
    <Button
      variant="outline"
      onPress={handlePress}
      disabled={loading || disabled}
      className="mb-2 h-12 w-full max-w-sm flex-row items-center justify-center gap-2 border border-input bg-background">
      {loading ? (
        <>
          <Icon as={Loader2} size={20} className="animate-spin text-foreground" />
          <Text className="text-base text-foreground">Signing in...</Text>
        </>
      ) : (
        <>
          <View className="h-5 w-5 items-center justify-center">
            <GoogleIcon size={20} />
          </View>
          <Text className="text-base font-medium text-foreground">Continue with Google</Text>
        </>
      )}
    </Button>
  );
}
