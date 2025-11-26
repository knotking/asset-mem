import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

type Environment = "dev" | "staging" | "prod";

const firebaseConfigs: Record<Environment, FirebaseOptions> = {
  dev: {
    projectId: "homegeekdemo",
    appId: "1:321433914812:web:d30bdb093dee72fb2d2fb9",
    storageBucket: "homegeekdemo.firebasestorage.app",
    apiKey: "AIzaSyC44gkEIt19KV51Y2cMlOJ9F9WepblX8sI",
    authDomain: "homegeekdemo.firebaseapp.com",
    messagingSenderId: "321433914812",
  },
  staging: {
    projectId: "homegeekdemo", // TODO: Update with staging project config
    appId: "1:321433914812:web:d30bdb093dee72fb2d2fb9",
    storageBucket: "homegeekdemo.firebasestorage.app",
    apiKey: "AIzaSyC44gkEIt19KV51Y2cMlOJ9F9WepblX8sI",
    authDomain: "homegeekdemo.firebaseapp.com",
    messagingSenderId: "321433914812",
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
    console.warn(`Unknown environment: ${env}, falling back to dev`);
    return firebaseConfigs.dev;
  }

  return config;
};

const app = !getApps().length ? initializeApp(getFirebaseConfig()) : getApp();
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

export { app, auth, storage, db };
