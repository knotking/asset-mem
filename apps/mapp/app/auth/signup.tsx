import React, { useReducer } from 'react';
import { View } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@homeapp/common/firebase';
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

interface SignupState {
  email: string;
  password: string;
  confirmPassword: string;
  error: string | null;
  success: string | null;
  loading: boolean;
}

type SignupAction =
  | { type: 'SET_EMAIL'; payload: string }
  | { type: 'SET_PASSWORD'; payload: string }
  | { type: 'SET_CONFIRM_PASSWORD'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUCCESS'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean };

export default function SignupScreen() {
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = React.useState(false);

  const reducer = (state: SignupState, action: SignupAction): SignupState => {
    switch (action.type) {
      case 'SET_EMAIL':
        return { ...state, email: action.payload };
      case 'SET_PASSWORD':
        return { ...state, password: action.payload };
      case 'SET_CONFIRM_PASSWORD':
        return { ...state, confirmPassword: action.payload };
      case 'SET_ERROR':
        return { ...state, error: action.payload, success: null, loading: false };
      case 'SET_SUCCESS':
        return { ...state, success: action.payload, error: null, loading: false };
      case 'SET_LOADING':
        return { ...state, loading: action.payload };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, {
    email: '',
    password: '',
    confirmPassword: '',
    error: null,
    success: null,
    loading: false,
  });

  const formDisabled = state.loading;
  const passwordsMatch =
    state.confirmPassword.length === 0 || state.password === state.confirmPassword;

  const handleOAuthSuccess = React.useCallback(() => {
    router.replace('/(tabs)/home');
  }, [router]);

  const handleOAuthError = React.useCallback((message: string) => {
    dispatch({ type: 'SET_ERROR', payload: message });
  }, []);

  const handleSignUp = async () => {
    const email = state.email.trim();
    if (!email) {
      dispatch({ type: 'SET_ERROR', payload: 'Please enter your email address.' });
      return;
    }
    if (!state.password) {
      dispatch({ type: 'SET_ERROR', payload: 'Please enter a password.' });
      return;
    }
    if (state.password !== state.confirmPassword) {
      dispatch({ type: 'SET_ERROR', payload: 'Passwords do not match.' });
      return;
    }

    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_SUCCESS', payload: null });
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await createUserWithEmailAndPassword(auth, email, state.password);
      authLog.debug('signup.success');
      router.replace('/(tabs)/home');
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
      authLog.debug('signup.errorCode', { code });
      const errorMessage = getAuthErrorMessage(code);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      authLog.warn('signup.failed', { cause: errorMessage });
    }
  };

  return (
    <AuthScreenShell
      title="Create Account"
      subtitle="Sign up to get started"
      formDisabled={formDisabled}
      error={state.error}
      success={state.success}
      onOAuthSuccess={handleOAuthSuccess}
      onOAuthError={handleOAuthError}
      showLegalNotice
      primaryAction={{
        label: 'Sign Up',
        loadingLabel: 'Creating Account…',
        onPress: handleSignUp,
      }}
      footer={
        <Link href="/auth/login">
          <Text className="text-center text-base text-muted-foreground">
            Already have an account?{' '}
            <Text className="font-semibold text-primary">Sign In</Text>
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
      <View className="relative mb-4 w-full">
        <Input
          placeholder="Enter your password"
          value={state.password}
          onChangeText={(text) => dispatch({ type: 'SET_PASSWORD', payload: text })}
          secureTextEntry={!passwordVisible}
          autoComplete="password-new"
          textContentType="newPassword"
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

      <AuthFieldLabel>Confirm Password</AuthFieldLabel>
      <View className="relative w-full">
        <Input
          placeholder="Confirm your password"
          value={state.confirmPassword}
          onChangeText={(text) => dispatch({ type: 'SET_CONFIRM_PASSWORD', payload: text })}
          secureTextEntry={!confirmPasswordVisible}
          autoComplete="password-new"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={handleSignUp}
          editable={!formDisabled}
          className="w-full pr-10"
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-0 right-0 top-0 w-10"
          disabled={formDisabled}
          accessibilityLabel={confirmPasswordVisible ? 'Hide password' : 'Show password'}
          onPress={() => setConfirmPasswordVisible((visible) => !visible)}>
          <Icon
            as={confirmPasswordVisible ? EyeOff : Eye}
            size={20}
            className="text-muted-foreground"
          />
        </Button>
      </View>
      {!passwordsMatch ? (
        <Text className="mt-2 text-sm text-destructive">Passwords do not match.</Text>
      ) : null}
    </AuthScreenShell>
  );
}
