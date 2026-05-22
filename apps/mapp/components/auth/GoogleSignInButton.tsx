import * as React from 'react';
import { InteractionManager, Platform, View } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, firebaseConfig } from '@homeapp/common/firebase';
import { GoogleIcon } from '@/components/auth/GoogleIcon';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Loader2 } from 'lucide-react-native';
import { createLogger } from '@/lib/logger';

const authLog = createLogger('auth');

/** Google blocks exp:// redirects — OAuth only works in a dev/production native build, not Expo Go. */
const IS_EXPO_GO = Constants.appOwnership === 'expo';

const EXPO_GO_MESSAGE =
  'Google sign-in does not work in Expo Go. Run a development build instead: npx expo run:ios (or run:android). See apps/mapp/docs/GOOGLE_SIGN_IN.md.';

const GOOGLE_AUTH_ERRORS: Record<string, string> = {
  'auth/account-exists-with-different-credential':
    'An account already exists with this email. Sign in with your original method.',
  'auth/invalid-credential': 'Google sign-in failed. Please try again.',
  'auth/operation-not-allowed': 'Google sign-in is not enabled for this app.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
};

type GoogleSignInButtonProps = {
  disabled?: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
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

export function GoogleSignInButton({ disabled, onSuccess, onError }: GoogleSignInButtonProps) {
  const [loading, setLoading] = React.useState(false);
  const mountedRef = React.useRef(false);
  const oauthStartedRef = React.useRef(false);
  const handledResponseRef = React.useRef<unknown>(null);
  const onSuccessRef = React.useRef(onSuccess);
  const onErrorRef = React.useRef(onError);

  React.useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  React.useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setLoadingSafe = React.useCallback((value: boolean) => {
    if (mountedRef.current) {
      setLoading(value);
    }
  }, []);

  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      webClientId: firebaseConfig.webClientId,
      iosClientId: firebaseConfig.iosClientId,
      androidClientId: firebaseConfig.androidClientId,
    },
    { scheme: 'homegeekai' }
  );

  React.useEffect(() => {
    if (!response || response === handledResponseRef.current) {
      return;
    }
    handledResponseRef.current = response;

    const notifyError = (message: string) => {
      runWhenMounted(mountedRef, () => onErrorRef.current(message));
    };
    const notifySuccess = () => {
      runWhenMounted(mountedRef, () => onSuccessRef.current());
    };

    if (response.type === 'success') {
      const idToken = response.params.id_token;
      if (!idToken) {
        notifyError('Google sign-in did not return a token. Please try again.');
        setLoadingSafe(false);
        return;
      }

      setLoadingSafe(true);
      const credential = GoogleAuthProvider.credential(idToken);
      signInWithCredential(auth, credential)
        .then(() => {
          authLog.debug('login.google.success');
          notifySuccess();
        })
        .catch((err: { code?: string; message?: string }) => {
          authLog.warn('login.google.failed', { code: err.code });
          const message =
            (err.code && GOOGLE_AUTH_ERRORS[err.code]) ||
            err.message ||
            'Google sign-in failed. Please try again.';
          notifyError(message);
        })
        .finally(() => setLoadingSafe(false));
      return;
    }

    if (!oauthStartedRef.current) {
      return;
    }

    if (response.type === 'error') {
      authLog.warn('login.google.oauthError', { error: response.error });
      notifyError(response.error?.message ?? 'Google sign-in was interrupted. Please try again.');
      setLoadingSafe(false);
      return;
    }

    if (response.type === 'dismiss' || response.type === 'cancel') {
      setLoadingSafe(false);
    }
  }, [response, setLoadingSafe]);

  const handlePress = async () => {
    if (!request || loading || disabled) return;
    if (IS_EXPO_GO) {
      runWhenMounted(mountedRef, () => onErrorRef.current(EXPO_GO_MESSAGE));
      return;
    }
    const configError = getGoogleOAuthConfigError();
    if (configError) {
      runWhenMounted(mountedRef, () => onErrorRef.current(configError));
      return;
    }
    oauthStartedRef.current = true;
    setLoadingSafe(true);
    try {
      const result = await promptAsync();
      if (result?.type === 'dismiss' || result?.type === 'cancel') {
        setLoadingSafe(false);
      }
    } catch (err: unknown) {
      setLoadingSafe(false);
      runWhenMounted(mountedRef, () =>
        onErrorRef.current(
          err instanceof Error ? err.message : 'Could not open Google sign-in.'
        )
      );
    }
  };

  return (
    <Button
      variant="outline"
      onPress={handlePress}
      disabled={IS_EXPO_GO || !request || loading || disabled}
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
