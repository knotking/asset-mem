import React, { useReducer } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '@homeapp/common/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Link, useRouter } from 'expo-router';
import { AuthDivider } from '@/components/auth/AuthDivider';
import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Eye, EyeOff, Loader2 } from 'lucide-react-native';
import { AssetMemWordmark } from '@/components/AssetMemWordmark';

import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { Input } from 'components/ui/input';
import { Text } from '../../components/ui/text';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/alert';
import { createLogger } from '@/lib/logger';

const authLog = createLogger('auth');
import { AlertCircle, CheckCircle } from 'lucide-react-native';

const getErrorMessage = (errorCode: string) => {
  const errorMessages: { [key: string]: string } = {
    'auth/invalid-email': 'The email address is not valid. Please enter a correct email address.',
    'auth/user-disabled': 'Your account has been disabled. Please contact support for assistance.',
    'auth/user-not-found': 'No account found with this email. Please sign up first.',
    'auth/wrong-password': 'Incorrect password. Please try again or reset your password.',
    'auth/invalid-credential':
      'Invalid email or password. Please check your credentials and try again.',
    'auth/email-already-in-use': 'The email address is already in use by another account.',
    'auth/operation-not-allowed':
      'Email/password accounts are not enabled. Enable email/password in the Firebase console.',
    'auth/weak-password': 'The password is too weak. Please use a stronger password.',
    'auth/missing-email': 'Please enter your email address.',
  };
  return errorMessages[errorCode] || 'An unexpected error occurred. Please try again later.';
};

export default function LoginScreen() {
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [authExtrasReady, setAuthExtrasReady] = React.useState(false);
  const [state, dispatch] = useReducer(
    (
      prevState: {
        email: string;
        password: string;
        error: string | null;
        success: string | null;
        loading: boolean;
      },
      action: { type: string; payload: any }
    ) => {
      switch (action.type) {
        case 'SET_EMAIL':
          return { ...prevState, email: action.payload };
        case 'SET_PASSWORD':
          return { ...prevState, password: action.payload };
        case 'SET_ERROR':
          return { ...prevState, error: action.payload, success: null, loading: false };
        case 'SET_SUCCESS':
          return { ...prevState, success: action.payload, error: null, loading: false };
        case 'SET_LOADING':
          return { ...prevState, loading: action.payload };
        default:
          return prevState;
      }
    },
    { email: '', password: '', error: null, success: null, loading: false }
  );

  React.useEffect(() => {
    setAuthExtrasReady(true);
  }, []);

  const handleGoogleSuccess = React.useCallback(() => {
    router.replace('/(tabs)/home');
  }, [router]);

  const handleGoogleError = React.useCallback(
    (message: string) => {
      dispatch({ type: 'SET_ERROR', payload: message });
    },
    [dispatch]
  );

  const handleSignIn = async () => {
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await signInWithEmailAndPassword(auth, state.email, state.password);
      authLog.debug('login.success');
      router.replace('/(tabs)/home');
    } catch (err: any) {
      authLog.debug('login.errorCode', { code: err.code });
      const errorMessage = getErrorMessage(err.code);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      authLog.warn('login.failed', { cause: errorMessage });
    }
  };

  const handleForgotPassword = async () => {
    if (!state.email) {
      dispatch({
        type: 'SET_ERROR',
        payload: 'Please enter your email address to reset your password.',
      });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, state.email);
      dispatch({
        type: 'SET_SUCCESS',
        payload: 'A password reset email has been sent to your email address.',
      });
    } catch (err: any) {
      const errorMessage = getErrorMessage(err.code);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom', 'left', 'right']}>
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={0}
      className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="items-center p-4 pt-2">
          <AssetMemWordmark size="auth" align="center" className="mb-6" />
          <Text className="mb-2 w-full text-center text-2xl font-bold leading-normal text-foreground">
            Welcome Back
          </Text>
          <Text className="mb-8 text-base text-gray-500">Sign in to manage your properties</Text>

          {authExtrasReady ? (
            <>
              {Platform.OS === 'ios' && (
                <AppleSignInButton
                  disabled={state.loading}
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                />
              )}
              <GoogleSignInButton
                disabled={state.loading}
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
              />
            </>
          ) : (
            <View className="mb-2 h-12 w-full max-w-sm" />
          )}
          <AuthDivider />

          <Text className="self-start text-base font-medium text-foreground">Email</Text>
          <Input
            placeholder="Enter your email"
            value={state.email}
            onChangeText={(text: string) => dispatch({ type: 'SET_EMAIL', payload: text })}
            keyboardType="email-address"
            autoCapitalize="none"
            textAlignVertical="center"
            className="shadow-xs mb-4 w-full max-w-sm rounded-md border border-input bg-gray-100 px-3 py-2 text-base text-foreground"
          />
          <Text className="self-start text-base font-medium text-foreground">Password</Text>
          <View className="relative mb-4 w-full max-w-sm">
            <Input
              placeholder="Enter your password"
              value={state.password}
              onChangeText={(text: string) => dispatch({ type: 'SET_PASSWORD', payload: text })}
              secureTextEntry={!passwordVisible}
              textAlignVertical="center"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
              className="shadow-xs w-full rounded-md border border-input bg-gray-100 px-3 py-2 pr-10 text-base text-foreground"
            />
            <Button
              variant="link"
              className="absolute right-0 top-0 h-full px-3"
              onPress={() => setPasswordVisible(!passwordVisible)}>
              <Icon as={passwordVisible ? EyeOff : Eye} size={20} className="text-gray-500" />
            </Button>
          </View>
          <Button variant="link" className="mb-8 self-end" onPress={handleForgotPassword}>
            <Text className="text-blue-600">Forgot Password?</Text>
          </Button>
          <Button
            onPress={handleSignIn}
            disabled={state.loading}
            className="mb-4 h-12 w-full bg-black text-white hover:bg-gray-800 active:bg-gray-900">
            {state.loading ? (
              <View className="flex-row items-center gap-2">
                <Icon as={Loader2} size={20} className="animate-spin text-white" />
                <Text className="text-lg text-white">Signing In...</Text>
              </View>
            ) : (
              <Text className="text-lg text-white">Sign In</Text>
            )}
          </Button>
          {(state.error || state.success) && (
            <View className="mb-2 w-full max-w-sm">
              {state.error && (
                <Alert icon={AlertCircle} variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}
              {state.success && (
                <Alert icon={CheckCircle} variant="default">
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>{state.success}</AlertDescription>
                </Alert>
              )}
            </View>
          )}

          <Link href="/auth/signup" className="mt-10 text-center text-primary">
            <Text className="text-base text-gray-500">
              Don't have an account? <Text className="font-semibold text-blue-600">Sign Up</Text>
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
