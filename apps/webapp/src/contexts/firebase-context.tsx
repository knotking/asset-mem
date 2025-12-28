'use client';

import React from 'react';
import { FirebaseProvider as CommonFirebaseProvider } from '@homeapp/common/contexts/firebase-context';
import { PreferencesProvider } from './preferences-context';
import { app, auth, db, storage } from '@/lib/firebase';

/**
 * Composite provider that wraps Firebase and Preferences contexts
 * for the webapp. CheckpointProvider is added at the property level
 * since it requires PropertyProvider.
 */
export const AppContextProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <CommonFirebaseProvider app={app} auth={auth} db={db} storage={storage}>
      <PreferencesProvider>
        {children}
      </PreferencesProvider>
    </CommonFirebaseProvider>
  );
};

// Re-export the useFirebase hook for convenience
export { useFirebase } from '@homeapp/common/contexts/firebase-context';

