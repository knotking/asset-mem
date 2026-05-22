'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

/**
 * Redirect unauthenticated users to login. Skips redirect during intentional logout
 * so /home routes do not flash a logged-out shell before navigation to `/`.
 */
export function useRequireAuth(loginPath = '/login') {
  const { user, loading, signingOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !signingOut) {
      router.replace(loginPath);
    }
  }, [user, loading, signingOut, router, loginPath]);

  return { user, loading, signingOut, authPending: loading || signingOut };
}
