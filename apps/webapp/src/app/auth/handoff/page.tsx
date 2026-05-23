'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { useAuth } from '@/contexts/auth-context';
import { consumeMobileWebHandoff } from '@/lib/auth-handoff-client';
import { getHandoffErrorMessage } from '@/lib/auth-handoff-errors';
import { MobileHandoffShell } from '@/components/auth/mobile-handoff-shell';

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
          setError(getHandoffErrorMessage(e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth, code, router]);

  if (error) {
    return (
      <MobileHandoffShell
        variant="error"
        errorMessage={error}
        onRetryLogin={() => router.replace('/login')}
      />
    );
  }

  return (
    <MobileHandoffShell
      variant="loading"
      description="Taking you to Plan & billing with the same account you use in the mobile app."
    />
  );
}

export default function MobileAuthHandoffPage() {
  return (
    <Suspense fallback={<MobileHandoffShell variant="loading" />}>
      <HandoffPageContent />
    </Suspense>
  );
}
