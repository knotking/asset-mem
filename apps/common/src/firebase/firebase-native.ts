import { app, firebaseConfig } from "./firebase-config";

import { getAuth, initializeAuth, type Auth } from "firebase/auth";
// @ts-ignore
import { getReactNativePersistence } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirestore, type Firestore } from "firebase/firestore";
import type { FirebaseApp } from "firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Initialize auth with proper persistence for React Native
// This handles both initial load and hot module reloads
function initAuth(): Auth {
  // For web, use standard getAuth
  if (Platform.OS === "web") {
    return getAuth(app);
  }

  // For React Native, try initializeAuth with persistence first
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error: any) {
    console.error("[auth] signIn.error", error);
    // If already initialized (happens on hot reload), getAuth returns the existing instance
    // The persistence configuration from the first initialization is preserved
    if (error?.code === "auth/already-initialized") {
      return getAuth(app);
    }
    throw error;
  }
}

// Initialize auth - called once per module load
const auth: Auth = initAuth();

const storage: FirebaseStorage = getStorage(app);
const db: Firestore = getFirestore(app);

export { app, auth, storage, db, firebaseConfig };
export type { Auth, FirebaseStorage, Firestore, FirebaseApp };
