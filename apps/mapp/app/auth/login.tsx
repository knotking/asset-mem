import React, { useReducer } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { auth, firebaseConfig } from '@homeapp/common/firebase';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import GoogleSvg from '../assets/images/google-icon.svg';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Link, useRouter } from 'expo-router';
import { Home, Eye, EyeOff, Loader2 } from 'lucide-react-native';

import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { Input } from 'components/ui/input';
import { Text } from '../../components/ui/text';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/alert';
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

WebBrowser.maybeCompleteAuthSession();

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

  const [requestGoogle, responseGoogle, promptAsyncGoogle] = Google.useAuthRequest({
    clientId: firebaseConfig.webClientId,
  });

  React.useEffect(() => {
    if (responseGoogle?.type === 'success') {
      const { id_token } = responseGoogle.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).then(() => {
        console.log('[LOGIN] Google sign-in successful, navigating to home');
        router.replace('/(tabs)/home');
      });
    }
  }, [responseGoogle, router]);

  const handleSignIn = async () => {
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await signInWithEmailAndPassword(auth, state.email, state.password);
      console.log('[LOGIN] Sign-in successful, navigating to home');
      router.replace('/(tabs)/home');
    } catch (err: any) {
      console.log('ERROR CODE:', err.code);
      const errorMessage = getErrorMessage(err.code);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      console.log('[LOGIN] Sign-in failed:', errorMessage);
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
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={0}
      className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="flex-1 items-center justify-center p-4">
          <Icon as={Home} size={48} className="mb-6 text-foreground" />
          <Text className="mb-2 text-2xl font-bold">Welcome Back</Text>
          <Text className="mb-8 text-base text-gray-500">Sign in to manage your properties</Text>
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
          <View className="min-h-[100px] w-full max-w-sm">
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

          <Link href="/auth/signup" className="mt-10 text-center text-primary">
            <Text className="text-base text-gray-500">
              Don't have an account? <Text className="font-semibold text-blue-600">Sign Up</Text>
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
