import * as React from 'react';
import { View } from 'react-native';
import Constants from 'expo-constants';
import { GoogleIcon } from '@/components/auth/GoogleIcon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/** Native Google Sign-In is not available in Expo Go (no RNGoogleSignin TurboModule). */
export const IS_EXPO_GO = Constants.appOwnership === 'expo';

export const EXPO_GO_MESSAGE =
  'Google sign-in does not work in Expo Go. Run a development build instead: npx expo run:ios (or run:android). See apps/mapp/docs/GOOGLE_SIGN_IN.md.';

export type GoogleSignInButtonProps = {
  disabled?: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
};

function GoogleSignInButtonExpoGo({ disabled: _disabled }: GoogleSignInButtonProps) {
  return (
    <Button
      variant="outline"
      disabled
      className="mb-2 h-12 w-full max-w-sm flex-row items-center justify-center gap-2 border border-input bg-background opacity-60">
      <View className="h-5 w-5 items-center justify-center">
        <GoogleIcon size={20} />
      </View>
      <Text className="text-base font-medium text-foreground">Continue with Google</Text>
    </Button>
  );
}

function GoogleSignInButtonNativeLoader(props: GoogleSignInButtonProps) {
  const [NativeButton, setNativeButton] = React.useState<
    React.ComponentType<GoogleSignInButtonProps> | null
  >(null);

  React.useEffect(() => {
    let cancelled = false;
    import('./GoogleSignInButtonNative')
      .then((mod) => {
        if (!cancelled) {
          setNativeButton(() => mod.GoogleSignInButtonNative);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNativeButton(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!NativeButton) {
    return <GoogleSignInButtonExpoGo {...props} disabled />;
  }

  return <NativeButton {...props} />;
}

export function GoogleSignInButton(props: GoogleSignInButtonProps) {
  if (IS_EXPO_GO) {
    return <GoogleSignInButtonExpoGo {...props} />;
  }
  return <GoogleSignInButtonNativeLoader {...props} />;
}
