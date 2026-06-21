import React, { useReducer } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@homeapp/common/firebase';
import { Link, useRouter } from 'expo-router';
import { AuthDivider } from '@/components/auth/AuthDivider';
import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Text } from '../../components/ui/text';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/alert';
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2 } from 'lucide-react-native';
import { AssetMemWordmark } from '@/components/AssetMemWordmark';
import { Icon } from '../../components/ui/icon';
import { createLogger } from '@/lib/logger';

const authLog = createLogger('auth');

const getErrorMessage = (errorCode: string) => {
  const errorMessages: { [key: string]: string } = {
    'auth/invalid-email': 'The email address is not valid. Please enter a correct email address.',
    'auth/email-already-in-use': 'The email address is already in use by another account.',
    'auth/operation-not-allowed':
      'Email/password accounts are not enabled. Enable email/password in the Firebase console.',
    'auth/weak-password':
      'The password is too weak. Please use a stronger password (at least 6 characters).',
    'auth/missing-email': 'Please enter your email address.',
  };
  return errorMessages[errorCode] || 'An unexpected error occurred. Please try again later.';
};

export default function SignupScreen() {
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = React.useState(false);
  const [authExtrasReady, setAuthExtrasReady] = React.useState(false);

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

  const handleSignUp = async () => {
    if (state.password !== state.confirmPassword) {
      dispatch({ type: 'SET_ERROR', payload: 'Passwords do not match.' });
      return;
    }
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await createUserWithEmailAndPassword(auth, state.email, state.password);
      authLog.debug('signup.success');
      router.replace('/(tabs)/home');
    } catch (err: any) {
      authLog.debug('signup.errorCode', { code: err.code });
      const errorMessage = getErrorMessage(err.code);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      authLog.warn('signup.failed', { cause: errorMessage });
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
            Create Account
          </Text>
          <Text className="mb-8 text-base text-gray-500">Sign up to get started</Text>

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
            onChangeText={(text) => dispatch({ type: 'SET_EMAIL', payload: text })}
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
              onChangeText={(text) => dispatch({ type: 'SET_PASSWORD', payload: text })}
              secureTextEntry={!passwordVisible}
              textAlignVertical="center"
              className="shadow-xs w-full rounded-md border border-input bg-gray-100 px-3 py-2 pr-10 text-base text-foreground"
            />
            <Button
              variant="link"
              className="absolute right-0 top-0 h-full px-3"
              onPress={() => setPasswordVisible(!passwordVisible)}>
              <Icon as={passwordVisible ? EyeOff : Eye} size={20} className="text-gray-500" />
            </Button>
          </View>

          <Text className="self-start text-base font-medium text-foreground">Confirm Password</Text>
          <View className="relative mb-8 w-full max-w-sm">
            <Input
              placeholder="Confirm your password"
              value={state.confirmPassword}
              onChangeText={(text) => dispatch({ type: 'SET_CONFIRM_PASSWORD', payload: text })}
              secureTextEntry={!confirmPasswordVisible}
              textAlignVertical="center"
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
              className="shadow-xs w-full rounded-md border border-input bg-gray-100 px-3 py-2 pr-10 text-base text-foreground"
            />
            <Button
              variant="link"
              className="absolute right-0 top-0 h-full px-3"
              onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}>
              <Icon
                as={confirmPasswordVisible ? EyeOff : Eye}
                size={20}
                className="text-gray-500"
              />
            </Button>
          </View>

          <Button
            onPress={handleSignUp}
            disabled={state.loading}
            className="mb-4 h-12 w-full max-w-sm bg-black text-white hover:bg-gray-800 active:bg-gray-900">
            {state.loading ? (
              <View className="flex-row items-center gap-2">
                <Icon as={Loader2} size={20} className="animate-spin text-white" />
                <Text className="text-lg text-white">Creating Account...</Text>
              </View>
            ) : (
              <Text className="text-lg text-white">Sign Up</Text>
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

          <Link href="/auth/login" className="mt-10 text-center text-primary">
            <Text className="text-base text-gray-500">
              Already have an account? <Text className="font-semibold text-blue-600">Sign in</Text>
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
