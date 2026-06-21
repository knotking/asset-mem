import React, { useReducer } from 'react';
import { View } from 'react-native';
import { auth } from '@homeapp/common/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Link, useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { AuthFieldLabel, AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import { createLogger } from '@/lib/logger';

const authLog = createLogger('auth');

export default function LoginScreen() {
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [state, dispatch] = useReducer(
    (
      prevState: {
        email: string;
        password: string;
        error: string | null;
        success: string | null;
        loading: boolean;
      },
      action: { type: string; payload: string | null | boolean }
    ) => {
      switch (action.type) {
        case 'SET_EMAIL':
          return { ...prevState, email: action.payload as string };
        case 'SET_PASSWORD':
          return { ...prevState, password: action.payload as string };
        case 'SET_ERROR':
          return { ...prevState, error: action.payload as string | null, success: null, loading: false };
        case 'SET_SUCCESS':
          return { ...prevState, success: action.payload as string | null, error: null, loading: false };
        case 'SET_LOADING':
          return { ...prevState, loading: action.payload as boolean };
        default:
          return prevState;
      }
    },
    { email: '', password: '', error: null, success: null, loading: false }
  );

  const formDisabled = state.loading;

  const handleOAuthSuccess = React.useCallback(() => {
    router.replace('/(tabs)/home');
  }, [router]);

  const handleOAuthError = React.useCallback((message: string) => {
    dispatch({ type: 'SET_ERROR', payload: message });
  }, []);

  const handleSignIn = async () => {
    const email = state.email.trim();
    if (!email) {
      dispatch({ type: 'SET_ERROR', payload: 'Please enter your email address.' });
      return;
    }
    if (!state.password) {
      dispatch({ type: 'SET_ERROR', payload: 'Please enter your password.' });
      return;
    }

    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_SUCCESS', payload: null });
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await signInWithEmailAndPassword(auth, email, state.password);
      authLog.debug('login.success');
      router.replace('/(tabs)/home');
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
      authLog.debug('login.errorCode', { code });
      const errorMessage = getAuthErrorMessage(code);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      authLog.warn('login.failed', { cause: errorMessage });
    }
  };

  const handleForgotPassword = async () => {
    const email = state.email.trim();
    if (!email) {
      dispatch({
        type: 'SET_ERROR',
        payload: 'Please enter your email address to reset your password.',
      });
      return;
    }
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      await sendPasswordResetEmail(auth, email);
      dispatch({
        type: 'SET_SUCCESS',
        payload: 'A password reset email has been sent to your email address.',
      });
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
      dispatch({ type: 'SET_ERROR', payload: getAuthErrorMessage(code) });
    }
  };

  return (
    <AuthScreenShell
      title="Welcome Back"
      subtitle="Sign in to manage your properties"
      formDisabled={formDisabled}
      error={state.error}
      success={state.success}
      onOAuthSuccess={handleOAuthSuccess}
      onOAuthError={handleOAuthError}
      primaryAction={{
        label: 'Sign In',
        loadingLabel: 'Signing In…',
        onPress: handleSignIn,
      }}
      footer={
        <Link href="/auth/signup">
          <Text className="text-center text-base text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Text className="font-semibold text-primary">Sign Up</Text>
          </Text>
        </Link>
      }>
      <AuthFieldLabel>Email</AuthFieldLabel>
      <Input
        placeholder="Enter your email"
        value={state.email}
        onChangeText={(text) => dispatch({ type: 'SET_EMAIL', payload: text })}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        editable={!formDisabled}
        className="mb-4 w-full"
      />

      <AuthFieldLabel>Password</AuthFieldLabel>
      <View className="relative mb-2 w-full">
        <Input
          placeholder="Enter your password"
          value={state.password}
          onChangeText={(text) => dispatch({ type: 'SET_PASSWORD', payload: text })}
          secureTextEntry={!passwordVisible}
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={handleSignIn}
          editable={!formDisabled}
          className="w-full pr-10"
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-0 right-0 top-0 w-10"
          disabled={formDisabled}
          accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
          onPress={() => setPasswordVisible((visible) => !visible)}>
          <Icon as={passwordVisible ? EyeOff : Eye} size={20} className="text-muted-foreground" />
        </Button>
      </View>

      <Button
        variant="link"
        className="mb-2 self-end px-0"
        disabled={formDisabled}
        onPress={handleForgotPassword}>
        <Text className="text-sm text-primary">Forgot Password?</Text>
      </Button>
    </AuthScreenShell>
  );
}
