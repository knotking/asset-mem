'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { trackSignUp } from '@/lib/analytics';
import { AuthScreenShell } from '@/components/auth/auth-screen-shell';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { AuthDivider } from '@/components/auth/auth-divider';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import {
  completeAuthThenStripeCheckout,
  isBillingCheckoutTier,
  postAuthRedirectPath,
} from '@/lib/pending-checkout';

function SignupPageContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutTier = searchParams.get('checkout');
  const { toast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const cred = await signUp(email, password);
      trackSignUp('email');
      if (isBillingCheckoutTier(checkoutTier)) {
        await completeAuthThenStripeCheckout(cred.user, checkoutTier);
        return;
      }
      router.push(postAuthRedirectPath());
    } catch (error: unknown) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: string }).code)
          : '';
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: getAuthErrorMessage(code, error instanceof Error ? error.message : undefined),
      });
      setIsLoading(false);
    }
  };

  const formDisabled = isLoading;

  return (
    <AuthScreenShell
      title="Sign up"
      description="Create an account with Google or email to get started."
    >
      <GoogleSignInButton mode="signup" disabled={formDisabled} checkoutTier={checkoutTier} />
      <AuthDivider />
      <form onSubmit={handleSignUp} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={formDisabled}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={formDisabled}
          />
        </div>
        <Button type="submit" className="w-full" disabled={formDisabled}>
          {isLoading ? 'Creating Account...' : 'Create Account with Email'}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        By creating an account, you agree to our{' '}
        <Link href="/terms" className="underline hover:text-foreground">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-4 text-center text-sm">
        Already have an account?{' '}
        <Link
          href={
            checkoutTier ? `/login?checkout=${encodeURIComponent(checkoutTier)}` : '/login'
          }
          className="underline"
        >
          Sign in
        </Link>
      </div>
    </AuthScreenShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <AuthScreenShell title="Sign up" description="Loading…">
          <div className="h-40" aria-hidden />
        </AuthScreenShell>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}
