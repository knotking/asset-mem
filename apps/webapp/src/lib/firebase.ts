import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { createLogger } from "@/lib/logger";

const firebaseLog = createLogger("firebase");
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

type Environment = "dev" | "staging" | "prod";

const firebaseConfigs: Record<Environment, FirebaseOptions> = {
  dev: {
    apiKey: "AIzaSyD5LbNLSj8sudtwlJnpPkY0Qjtuv7T6rss",
    authDomain: "homegeek-staging.firebaseapp.com",
    projectId: "homegeek-staging",
    storageBucket: "homegeek-staging.firebasestorage.app",
    messagingSenderId: "291418967332",
    appId: "1:291418967332:web:32ced0cdd668eb4018b7b1",
    measurementId: "G-M3VECYV1FM",
  },
  staging: {
    apiKey: "AIzaSyD5LbNLSj8sudtwlJnpPkY0Qjtuv7T6rss",
    authDomain: "homegeek-staging.firebaseapp.com",
    projectId: "homegeek-staging",
    storageBucket: "homegeek-staging.firebasestorage.app",
    messagingSenderId: "291418967332",
    appId: "1:291418967332:web:32ced0cdd668eb4018b7b1",
    measurementId: "G-M3VECYV1FM",
  },
  prod: {
    apiKey: "AIzaSyCDVN02byPassK2gasba6IH6_2dXkFUywI",
    authDomain: "homegeek-prod.firebaseapp.com",
    projectId: "homegeek-prod",
    storageBucket: "homegeek-prod.firebasestorage.app",
    messagingSenderId: "686746113874",
    appId: "1:686746113874:web:2e470647c709a56f4a4c8b",
  },
};

const getFirebaseConfig = (): FirebaseOptions => {
  const env = (process.env.NEXT_PUBLIC_ENV as Environment) || "dev";

  const config = firebaseConfigs[env];

  if (!config) {
    firebaseLog.warn("unknownEnvironment", { env });
    return firebaseConfigs.dev;
  }

  return config;
};

const app = !getApps().length ? initializeApp(getFirebaseConfig()) : getApp();
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

export { app, auth, storage, db };
