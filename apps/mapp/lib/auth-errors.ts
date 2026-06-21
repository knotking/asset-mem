/** User-facing Firebase Auth error messages (parity with apps/webapp/src/lib/auth-errors.ts). */

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'The email address is not valid.',
  'auth/user-disabled': 'This account has been disabled. Contact support.',
  'auth/user-not-found': 'No account found with this email. Sign up first.',
  'auth/wrong-password': 'Incorrect password. Try again or reset your password.',
  'auth/invalid-credential': 'Invalid email or password. Check your credentials.',
  'auth/email-already-in-use': 'This email is already registered. Try signing in.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email. Sign in with your original method.',
};

export function getAuthErrorMessage(code: string, fallback?: string): string {
  return AUTH_ERROR_MESSAGES[code] ?? fallback ?? 'Something went wrong. Please try again.';
}
