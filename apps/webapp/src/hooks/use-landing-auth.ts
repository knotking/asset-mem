'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { readAuthHint } from '@/lib/auth-hint';

/**
 * Landing CTAs: read localStorage hint in useLayoutEffect (before paint), confirm with Firebase.
 * No full-page gate — avoids blank flash on Android bfcache / tab restore.
 */
export function useLandingAuth(): {
  isAuthenticated: boolean;
  authResolved: boolean;
} {
  const { user, loading } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useLayoutEffect(() => {
    setIsAuthenticated(readAuthHint());
  }, []);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIsAuthenticated(readAuthHint());
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    setIsAuthenticated(Boolean(user));
  }, [user, loading]);

  return { isAuthenticated, authResolved: !loading };
}
