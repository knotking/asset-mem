import React, { useReducer } from 'react';
import { Alert, View } from 'react-native';
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import GoogleSvg from '../assets/images/google-icon.svg';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Link } from 'expo-router';
import { Home, Eye, EyeOff } from 'lucide-react-native';

import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { Input } from 'components/ui/input';
import { Text } from '../../components/ui/text';
import { firebaseConfig } from '../../firebaseConfig';

const getErrorMessage = (errorCode: string) => {
  const errorMessages: { [key: string]: string } = {
    'auth/invalid-email': 'The email address is not valid. Please enter a correct email address.',
    'auth/user-disabled': 'Your account has been disabled. Please contact support for assistance.',
    'auth/user-not-found': 'No account found with this email. Please sign up first.',
    'auth/wrong-password': 'Incorrect password. Please try again or reset your password.',
    'auth/email-already-in-use': 'The email address is already in use by another account.',
    'auth/operation-not-allowed':
      'Email/password accounts are not enabled. Enable email/password in the Firebase console.',
    'auth/weak-password': 'The password is too weak. Please use a stronger password.',
    'auth/missing-email': 'Please enter your email address.',
  };
  return errorMessages[errorCode] || 'An unexpected error occurred. Please try again later.';
};

WebBrowser.maybeCompleteAuthSession();
initializeApp(firebaseConfig);

export default function LoginScreen() {
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [state, dispatch] = useReducer(
    (
      prevState: { email: string; password: string; error: string | null },
      action: { type: string; payload: any }
    ) => {
      switch (action.type) {
        case 'SET_EMAIL':
          return { ...prevState, email: action.payload };
        case 'SET_PASSWORD':
          return { ...prevState, password: action.payload };
        case 'SET_ERROR':
          return { ...prevState, error: action.payload };
        default:
          return prevState;
      }
    },
    { email: '', password: '', error: null }
  );

  const [requestGoogle, responseGoogle, promptAsyncGoogle] = Google.useAuthRequest({
    clientId: firebaseConfig.webClientId,
  });

  React.useEffect(() => {
    if (responseGoogle?.type === 'success') {
      const { id_token } = responseGoogle.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(getAuth(), credential);
    }
  }, [responseGoogle]);

  const handleSignIn = async () => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      await signInWithEmailAndPassword(getAuth(), state.email, state.password);
      // Navigation will be handled by AuthContext listener in _layout.tsx
    } catch (err: any) {
      const errorMessage = getErrorMessage(err.code);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  };

  const handleForgotPassword = async () => {
    if (!state.email) {
      Alert.alert('Forgot Password', 'Please enter your email address to reset your password.');
      return;
    }
    try {
      await sendPasswordResetEmail(getAuth(), state.email);
      Alert.alert('Forgot Password', 'A password reset email has been sent to your email address.');
    } catch (err: any) {
      const errorMessage = getErrorMessage(err.code);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-background p-4">
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
        className="mb-4 w-full max-w-sm rounded-md border border-input bg-gray-100 px-3 py-2 text-base text-foreground shadow-sm"
      />
      <Text className="self-start text-base font-medium text-foreground">Password</Text>
      <View className="relative mb-4 w-full max-w-sm">
        <Input
          placeholder="Enter your password"
          value={state.password}
          onChangeText={(text: string) => dispatch({ type: 'SET_PASSWORD', payload: text })}
          secureTextEntry={!passwordVisible}
          className="w-full rounded-md border border-input bg-gray-100 px-3 py-2 pr-10 text-base text-foreground shadow-sm"
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
      {state.error && <Text className="mb-4 text-red-500">{state.error}</Text>}
      <Button
        onPress={handleSignIn}
        className="h-12 w-full bg-black text-white hover:bg-gray-800 active:bg-gray-900">
        <Text className="text-lg text-white">Sign In</Text>
      </Button>

      <Link href="/auth/signup" className="mt-10 text-center text-primary">
        <Text className="text-base text-gray-500">
          Don't have an account? <Text className="font-semibold text-blue-600">Sign Up</Text>
        </Text>
      </Link>
    </View>
  );
}
