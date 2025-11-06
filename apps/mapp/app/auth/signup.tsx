import React, { useReducer } from 'react';
import { View } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@homeapp/common/firebase';
import { Link, useRouter } from 'expo-router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Text } from '../../components/ui/text';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react-native';

export default function SignupScreen() {
  const router = useRouter();
  interface SignupState {
    email: string;
    password: string;
    confirmPassword: string;
    error: string | null;
    success: string | null;
  }

  type SignupAction =
    | { type: 'SET_EMAIL'; payload: string }
    | { type: 'SET_PASSWORD'; payload: string }
    | { type: 'SET_CONFIRM_PASSWORD'; payload: string }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_SUCCESS'; payload: string | null };

  const reducer = (state: SignupState, action: SignupAction): SignupState => {
    switch (action.type) {
      case 'SET_EMAIL':
        return { ...state, email: action.payload };
      case 'SET_PASSWORD':
        return { ...state, password: action.payload };
      case 'SET_CONFIRM_PASSWORD':
        return { ...state, confirmPassword: action.payload };
      case 'SET_ERROR':
        return { ...state, error: action.payload, success: null };
      case 'SET_SUCCESS':
        return { ...state, success: action.payload, error: null };
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
  });

  const handleSignUp = async () => {
    if (state.password !== state.confirmPassword) {
      dispatch({ type: 'SET_ERROR', payload: 'Passwords do not match.' });
      return;
    }
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      await createUserWithEmailAndPassword(auth, state.email, state.password);
      console.log('[SIGNUP] Sign-up successful, navigating to home');
      router.replace('/(tabs)/home');
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
      console.log('[SIGNUP] Sign-up failed:', err.message);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-background p-4">
      <Text className="mb-6 text-3xl font-bold">Create Account</Text>
      <Input
        placeholder="Email"
        value={state.email}
        onChangeText={(text) => dispatch({ type: 'SET_EMAIL', payload: text })}
        keyboardType="email-address"
        autoCapitalize="none"
        className="mb-4 w-full max-w-sm rounded-md border border-input bg-gray-100 px-3 py-2 text-base text-foreground shadow-sm"
      />
      <Input
        placeholder="Password"
        value={state.password}
        onChangeText={(text) => dispatch({ type: 'SET_PASSWORD', payload: text })}
        secureTextEntry
        className="mb-4 w-full max-w-sm rounded-md border border-input bg-gray-100 px-3 py-2 pr-10 text-base text-foreground shadow-sm"
      />
      <Input
        placeholder="Confirm Password"
        value={state.confirmPassword}
        onChangeText={(text) => dispatch({ type: 'SET_CONFIRM_PASSWORD', payload: text })}
        secureTextEntry
        className="mb-6 w-full max-w-sm rounded-md border border-input bg-gray-100 px-3 py-2 pr-10 text-base text-foreground shadow-sm"
      />
      {state.error && (
        <View className="mb-4 w-full max-w-sm">
          <Alert icon={AlertCircle} variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        </View>
      )}
      {state.success && (
        <View className="mb-4 w-full max-w-sm">
          <Alert icon={CheckCircle} variant="default">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{state.success}</AlertDescription>
          </Alert>
        </View>
      )}
      <Button onPress={handleSignUp} className="mb-4 w-full max-w-sm">
        <Text className="text-white">Sign Up</Text>
      </Button>
      <Link href="/auth/login" className="mt-2 text-primary">
        Already have an account? <Text className="font-semibold text-blue-600">Sign in</Text>
      </Link>
    </View>
  );
}
