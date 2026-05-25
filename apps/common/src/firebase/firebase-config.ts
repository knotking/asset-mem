import {
  initializeApp,
  getApps,
  getApp,
  FirebaseApp,
  FirebaseOptions,
} from "firebase/app";
import Constants from "expo-constants";
import { createLogger } from "../lib/logger";

const firebaseLog = createLogger("firebase");

type Environment = "dev" | "staging" | "prod";

/** Native Google OAuth IDs for com.assetmem.* — see apps/mapp/docs/GOOGLE_SIGN_IN.md */
interface FirebaseConfigWithClient extends FirebaseOptions {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
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
    iosClientId:
      "291418967332-42nd4f964tf4fn418ujhpm8sts2ca5kq.apps.googleusercontent.com",
    // com.assetmem.dev — update after registering Android app + SHA-1 in Firebase
    androidClientId:
      "291418967332-9h3ksf5no0havdt5tngpe9raaqdj8gs9.apps.googleusercontent.com",
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
    iosClientId:
      "291418967332-42nd4f964tf4fn418ujhpm8sts2ca5kq.apps.googleusercontent.com",
    // com.assetmem.staging
    androidClientId:
      "291418967332-jfqrfe03kg1rquj2h5audmv17un3n2do.apps.googleusercontent.com",
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
    iosClientId:
      "686746113874-st7gl80b5c0tdderi1165iajp870ac2s.apps.googleusercontent.com",
    // com.assetmem.app — update after registering Android app + SHA-1 in Firebase (do not reuse webClientId)
    androidClientId:
      "686746113874-b30qavgoodi22v703qh57ngdtra531g6.apps.googleusercontent.com",
  },
};

const getFirebaseConfig = (): FirebaseConfigWithClient => {
  const env =
    (Constants.expoConfig?.extra as { appEnv?: Environment } | undefined)
      ?.appEnv || "dev";

  const config = firebaseConfigs[env];

  if (!config) {
    firebaseLog.warn("unknownEnvironment", { env });
    return firebaseConfigs.dev;
  }

  return config;
};

const firebaseConfig = getFirebaseConfig();
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export { app, firebaseConfig };
