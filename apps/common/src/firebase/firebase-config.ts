import {
  initializeApp,
  getApps,
  getApp,
  FirebaseApp,
  FirebaseOptions,
} from "firebase/app";
import Constants from "expo-constants";

type Environment = "dev" | "staging" | "prod";

interface FirebaseConfigWithClient extends FirebaseOptions {
  webClientId?: string;
}

const firebaseConfigs: Record<Environment, FirebaseConfigWithClient> = {
  dev: {
    apiKey: "AIzaSyD5LbNLSj8sudtwlJnpPkY0Qjtuv7T6rss",
    authDomain: "homegeek-staging.firebaseapp.com",
    projectId: "homegeek-staging",
    storageBucket: "homegeek-staging.firebasestorage.app",
    messagingSenderId: "291418967332",
    appId: "1:291418967332:web:32ced0cdd668eb4018b7b1",
    measurementId: "G-M3VECYV1FM",
    webClientId:
      "291418967332-9lvvv4mtig8kmav1r2d9dr3u60tq04e7.apps.googleusercontent.com",
  },
  staging: {
    apiKey: "AIzaSyD5LbNLSj8sudtwlJnpPkY0Qjtuv7T6rss",
    authDomain: "homegeek-staging.firebaseapp.com",
    projectId: "homegeek-staging",
    storageBucket: "homegeek-staging.firebasestorage.app",
    messagingSenderId: "291418967332",
    appId: "1:291418967332:web:32ced0cdd668eb4018b7b1",
    measurementId: "G-M3VECYV1FM",
    webClientId:
      "291418967332-9lvvv4mtig8kmav1r2d9dr3u60tq04e7.apps.googleusercontent.com",
  },
  prod: {
    apiKey: "AIzaSyCDVN02byPassK2gasba6IH6_2dXkFUywI",
    authDomain: "homegeek-prod.firebaseapp.com",
    projectId: "homegeek-prod",
    storageBucket: "homegeek-prod.firebasestorage.app",
    messagingSenderId: "686746113874",
    appId: "1:686746113874:web:2e470647c709a56f4a4c8b",
    webClientId:
      "686746113874-b0002g07rkbatcdv45et44avs3p4hpbk.apps.googleusercontent.com",
  },
};

const getFirebaseConfig = (): FirebaseConfigWithClient => {
  const env = (Constants.expoConfig?.extra?.appEnv as Environment) || "dev";

  const config = firebaseConfigs[env];

  if (!config) {
    console.warn(`[firebase] Unknown environment: ${env}, falling back to dev`);
    return firebaseConfigs.dev;
  }

  return config;
};

const firebaseConfig = getFirebaseConfig();
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export { app, firebaseConfig };
