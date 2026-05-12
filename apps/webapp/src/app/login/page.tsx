'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { AuthDivider } from '@/components/auth/auth-divider';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import {
  completeAuthThenStripeCheckout,
  isBillingCheckoutTier,
  postAuthRedirectPath,
} from '@/lib/pending-checkout';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutTier = searchParams.get('checkout');
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const cred = await login(email, password);
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
        title: 'Login Failed',
        description: getAuthErrorMessage(code, error instanceof Error ? error.message : undefined),
      });
      setIsLoading(false);
    }
  };

  const formDisabled = isLoading;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background w-full">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Sign in with Google or your email to manage your properties.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleSignInButton
            mode="login"
            disabled={formDisabled}
            checkoutTier={checkoutTier}
          />
          <AuthDivider />
          <form onSubmit={handleLogin} className="grid gap-4">
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
              {isLoading ? 'Signing In...' : 'Sign In with Email'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            {' · '}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>
          </p>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link
              href={
                checkoutTier
                  ? `/signup?checkout=${encodeURIComponent(checkoutTier)}`
                  : '/signup'
              }
              className="underline"
            >
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
