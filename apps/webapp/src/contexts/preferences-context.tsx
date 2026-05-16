'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { UserPreferences, CheckpointComparisonPreferences } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { createLogger } from "@/lib/logger";

const prefsLog = createLogger("preferences");
import { useFirebase } from "@/contexts/firebase-context";

interface PreferencesContextType {
  preferences: UserPreferences | null;
  loading: boolean;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  updateCheckpointComparison: (
    updates: Partial<CheckpointComparisonPreferences>
  ) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined
);

// Default preferences
const DEFAULT_CHECKPOINT_COMPARISON: CheckpointComparisonPreferences = {
  enabled: true,
  maxAgeDays: 180,
  minAssetConfidence: 0.3,
};

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const { db } = useFirebase();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  // Load preferences from Firestore
  useEffect(() => {
    if (!user || !db) {
      setPreferences(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const preferencesRef = doc(db, "users", user.uid, "preferences", "user");

    const unsubscribe = onSnapshot(
      preferencesRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as UserPreferences;
          setPreferences(data);
        } else {
          // Initialize with defaults if not exists
          const defaultPrefs: UserPreferences = {
            checkpointComparison: DEFAULT_CHECKPOINT_COMPARISON,
          };
          setPreferences(defaultPrefs);
        }
        setLoading(false);
      },
      (error) => {
        prefsLog.error("preferences.load.failed", undefined, error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, db]);

  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferences>) => {
      if (!user || !db) {
        throw new Error("User not authenticated");
      }

      const preferencesRef = doc(db, "users", user.uid, "preferences", "user");

      try {
        const currentData = preferences || {};
        await setDoc(
          preferencesRef,
          {
            ...currentData,
            ...updates,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        prefsLog.error("preferences.update.failed", undefined, error);
        throw error;
      }
    },
    [user, db, preferences]
  );

  const updateCheckpointComparison = useCallback(
    async (updates: Partial<CheckpointComparisonPreferences>) => {
      if (!user || !db) {
        throw new Error("User not authenticated");
      }

      const currentComparison =
        preferences?.checkpointComparison || DEFAULT_CHECKPOINT_COMPARISON;

      await updatePreferences({
        checkpointComparison: {
          ...currentComparison,
          ...updates,
        },
      });
    },
    [preferences, updatePreferences, user, db]
  );

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        loading,
        updatePreferences,
        updateCheckpointComparison,
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
