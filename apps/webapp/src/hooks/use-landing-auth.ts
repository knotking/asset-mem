'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { readAuthHint } from '@/lib/auth-hint';

/**
 * Landing CTAs: block until localStorage hint is read in useLayoutEffect (before paint),
 * then confirm with Firebase when auth finishes loading.
 */
export function useLandingAuth(): {
  isAuthenticated: boolean;
  hintReady: boolean;
  authResolved: boolean;
} {
  const { user, loading } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hintReady, setHintReady] = useState(false);

  useLayoutEffect(() => {
    setIsAuthenticated(readAuthHint());
    setHintReady(true);
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    setIsAuthenticated(Boolean(user));
  }, [user, loading]);

  return { isAuthenticated, hintReady, authResolved: !loading };
}
