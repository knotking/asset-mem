import * as React from 'react';
import { InteractionManager, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { OAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '@homeapp/common/firebase';
import { createLogger } from '@/lib/logger';
import type { AppleSignInButtonProps } from './AppleSignInButton';

const authLog = createLogger('auth');

const APPLE_AUTH_ERRORS: Record<string, string> = {
  'auth/account-exists-with-different-credential':
    'An account already exists with this email. Sign in with your original method.',
  'auth/invalid-credential': 'Apple sign-in failed. Please try again.',
  'auth/operation-not-allowed': 'Apple sign-in is not enabled for this app.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
};

function runWhenMounted(mountedRef: React.RefObject<boolean>, fn: () => void) {
  InteractionManager.runAfterInteractions(() => {
    if (mountedRef.current) {
      fn();
    }
  });
}

/** Native Sign in with Apple — physical device builds only (not Expo Go). */
export function AppleSignInButtonNative({
  disabled,
  onSuccess,
  onError,
}: AppleSignInButtonProps) {
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const signingInRef = React.useRef(false);
  const mountedRef = React.useRef(false);
  const onSuccessRef = React.useRef(onSuccess);
  const onErrorRef = React.useRef(onError);

  React.useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  React.useEffect(() => {
    mountedRef.current = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (mountedRef.current) {
          setAvailable(ok);
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setAvailable(false);
        }
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handlePress = async () => {
    if (signingInRef.current || disabled || available === false) return;

    signingInRef.current = true;
    try {
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken } = appleCredential;
      if (!identityToken) {
        runWhenMounted(mountedRef, () =>
          onErrorRef.current('Apple sign-in did not return a token. Please try again.')
        );
        return;
      }

      const provider = new OAuthProvider('apple.com');
      const firebaseCredential = provider.credential({ idToken: identityToken });
      await signInWithCredential(auth, firebaseCredential);
      authLog.debug('login.apple.success');
      runWhenMounted(mountedRef, () => onSuccessRef.current());
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'ERR_REQUEST_CANCELED'
      ) {
        return;
      }

      const firebaseCode =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : undefined;
      const message =
        (firebaseCode && APPLE_AUTH_ERRORS[firebaseCode]) ||
        (err instanceof Error ? err.message : null) ||
        'Apple sign-in failed. Please try again.';
      authLog.warn('login.apple.failed', { code: firebaseCode, cause: message });
      runWhenMounted(mountedRef, () => onErrorRef.current(message));
    } finally {
      signingInRef.current = false;
    }
  };

  if (available === false) {
    return null;
  }

  return (
    <View className="mb-2 w-full max-w-sm items-center opacity-100">
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={8}
        style={{ width: '100%', maxWidth: 384, height: 48 }}
        onPress={handlePress}
      />
    </View>
  );
}
