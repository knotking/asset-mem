'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import type { UserPreferences, CheckpointComparisonPreferences } from "@/lib/types";
import { useAuth } from "./auth-context";
import { db } from "@/lib/firebase";

interface PreferencesContextType {
  preferences: UserPreferences | null;
  loading: boolean;
  updateCheckpointComparisonPreferences: (
    prefs: Partial<CheckpointComparisonPreferences>
  ) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined
);

const DEFAULT_CHECKPOINT_COMPARISON_PREFS: CheckpointComparisonPreferences = {
  enabled: true,
  maxAgeDays: 180,
  minAssetConfidence: 0.3,
};

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPreferences(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const docRef = doc(db, `users/${user.uid}/preferences/user`);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setPreferences(snapshot.data() as UserPreferences);
        } else {
          // Initialize with defaults if doesn't exist
          setPreferences({
            checkpointComparison: DEFAULT_CHECKPOINT_COMPARISON_PREFS,
          });
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching preferences:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const updateCheckpointComparisonPreferences = async (
    prefs: Partial<CheckpointComparisonPreferences>
  ) => {
    if (!user) return;

    const docRef = doc(db, `users/${user.uid}/preferences/user`);
    const currentCheckpointPrefs =
      preferences?.checkpointComparison || DEFAULT_CHECKPOINT_COMPARISON_PREFS;

    await setDoc(
      docRef,
      {
        checkpointComparison: {
          ...currentCheckpointPrefs,
          ...prefs,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        loading,
        updateCheckpointComparisonPreferences,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
};

