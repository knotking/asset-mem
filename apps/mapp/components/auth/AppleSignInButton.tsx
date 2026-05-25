import * as React from 'react';
import { Platform, View } from 'react-native';
import Constants from 'expo-constants';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/** Native Sign in with Apple is not available in Expo Go. */
export const IS_EXPO_GO = Constants.appOwnership === 'expo';

export const EXPO_GO_MESSAGE =
  'Sign in with Apple does not work in Expo Go. Use an EAS development or staging build on a physical iPhone.';

export type AppleSignInButtonProps = {
  disabled?: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
};

function AppleSignInButtonUnavailable({ disabled: _disabled }: AppleSignInButtonProps) {
  return (
    <Button
      variant="outline"
      disabled
      className="mb-2 h-12 w-full max-w-sm flex-row items-center justify-center gap-2 border border-input bg-black opacity-60">
      <Text className="text-base font-medium text-white">Continue with Apple</Text>
    </Button>
  );
}

function AppleSignInButtonNativeLoader(props: AppleSignInButtonProps) {
  const [NativeButton, setNativeButton] = React.useState<
    React.ComponentType<AppleSignInButtonProps> | null
  >(null);

  React.useEffect(() => {
    let cancelled = false;
    import('./AppleSignInButtonNative')
      .then((mod) => {
        if (!cancelled) {
          setNativeButton(() => mod.AppleSignInButtonNative);
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
    return <AppleSignInButtonUnavailable {...props} disabled />;
  }

  return <NativeButton {...props} />;
}

/** Sign in with Apple — iOS only; required when Google sign-in is offered (App Store Guideline 4.8). */
export function AppleSignInButton(props: AppleSignInButtonProps) {
  if (Platform.OS !== 'ios') {
    return null;
  }
  if (IS_EXPO_GO) {
    return <AppleSignInButtonUnavailable {...props} />;
  }
  return <AppleSignInButtonNativeLoader {...props} />;
}
