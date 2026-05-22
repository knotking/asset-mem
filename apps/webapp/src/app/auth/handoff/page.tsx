'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { useAuth } from '@/contexts/auth-context';
import { consumeMobileWebHandoff } from '@/lib/auth-handoff-client';

function HandoffPageContent() {
  const { auth } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError('Missing sign-in link. Open billing from the mobile app again.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { customToken, returnPath } = await consumeMobileWebHandoff(code);
        if (cancelled) return;
        await signInWithCustomToken(auth, customToken);
        if (cancelled) return;
        const path = returnPath.startsWith('/') ? returnPath : `/${returnPath}`;
        router.replace(path);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Could not sign in from the mobile app',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth, code, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6">
      {error ? (
        <>
          <p className="text-center text-sm text-destructive" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => router.replace('/login')}
          >
            Go to login
          </button>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">Signing you in…</p>
      )}
    </div>
  );
}

export default function MobileAuthHandoffPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <p className="text-muted-foreground text-sm">Signing you in…</p>
        </div>
      }
    >
      <HandoffPageContent />
    </Suspense>
  );
}
