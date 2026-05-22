'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
  type Auth,
} from 'firebase/auth';
import { app } from '@/lib/firebase';

const auth = getAuth(app);

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** True from logout() until navigation away from /home completes. */
  signingOut: boolean;
  auth: Auth;
  signUp: (email: string, password: string) => ReturnType<typeof createUserWithEmailAndPassword>;
  login: (email: string, password: string) => ReturnType<typeof signInWithEmailAndPassword>;
  signInWithGoogle: () => ReturnType<typeof signInWithPopup>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (signingOut && pathname === '/') {
      setSigningOut(false);
    }
  }, [pathname, signingOut]);

  const signUp = useCallback(
    (email: string, password: string) => createUserWithEmailAndPassword(auth, email, password),
    []
  );

  const login = useCallback(
    (email: string, password: string) => signInWithEmailAndPassword(auth, email, password),
    []
  );

  const signInWithGoogle = useCallback(() => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return signInWithPopup(auth, provider);
  }, []);

  const logout = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      setSigningOut(false);
      throw error;
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, loading, signingOut, auth, signUp, login, signInWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
