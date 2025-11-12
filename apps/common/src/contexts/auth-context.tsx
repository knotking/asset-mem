import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User,
  type Auth,
} from "firebase/auth";
import { useFirebase } from "./firebase-context";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  auth: Auth;
  signUp: (email: string, password: string) => Promise<import("firebase/auth").UserCredential>;
  login: (email: string, password: string) => Promise<import("firebase/auth").UserCredential>;
  logout: () => Promise<void>;
}

interface AuthProviderProps {
  children: React.ReactNode;
  onAuthStateChange?: (user: User | null) => void | Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children, onAuthStateChange }: AuthProviderProps) => {
  const { auth } = useFirebase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (authenticatedUser) => {
      // Only update state if component is still mounted
      if (isMounted) {
        setUser(authenticatedUser);
        setLoading(false);

        // Call platform-specific callback if provided (e.g., hide splash screen)
        if (onAuthStateChange) {
          await onAuthStateChange(authenticatedUser);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [auth, onAuthStateChange]);

  const logout = async () => {
    await signOut(auth);
  };

  const signUp = async (email: string, password: string) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const login = async (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        auth,
        signUp,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
