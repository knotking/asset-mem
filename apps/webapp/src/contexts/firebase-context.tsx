"use client";

import React, { createContext, useContext } from "react";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";
import type { FirebaseApp } from "firebase/app";
import { PreferencesProvider } from "./preferences-context";
import { ThemePreferenceSync } from "@/components/theme-preference-sync";
import { app, auth, db, storage } from "@/lib/firebase";

// Local Firebase context implementation (copied from @asset-mem/common for App Hosting compatibility)
interface FirebaseContextType {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(
  undefined
);

export interface FirebaseProviderProps {
  children: React.ReactNode;
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

const FirebaseProvider = ({
  children,
  app,
  auth,
  db,
  storage,
}: FirebaseProviderProps) => {
  return (
    <FirebaseContext.Provider value={{ app, auth, db, storage }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
};

/**
 * Composite provider that wraps Firebase and Preferences contexts
 * for the webapp. CheckpointProvider is added at the property level
 * since it requires PropertyProvider.
 */
export const AppContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <FirebaseProvider app={app} auth={auth} db={db} storage={storage}>
      <PreferencesProvider>
        <ThemePreferenceSync />
        {children}
      </PreferencesProvider>
    </FirebaseProvider>
  );
};
