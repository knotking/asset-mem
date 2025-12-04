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
    projectId: "homegeekdemo",
    appId: "1:321433914812:web:d30bdb093dee72fb2d2fb9",
    storageBucket: "homegeekdemo.firebasestorage.app",
    apiKey: "AIzaSyC44gkEIt19KV51Y2cMlOJ9F9WepblX8sI",
    authDomain: "homegeekdemo.firebaseapp.com",
    messagingSenderId: "321433914812",
    webClientId:
      "321433914812-898vs8tgasfvko1c9o71cdk0tosph570.apps.googleusercontent.com",
  },
  staging: {
    projectId: "homegeekdemo", // TODO: Update with staging project config
    appId: "1:321433914812:web:d30bdb093dee72fb2d2fb9",
    storageBucket: "homegeekdemo.firebasestorage.app",
    apiKey: "AIzaSyC44gkEIt19KV51Y2cMlOJ9F9WepblX8sI",
    authDomain: "homegeekdemo.firebaseapp.com",
    messagingSenderId: "321433914812",
    webClientId:
      "321433914812-898vs8tgasfvko1c9o71cdk0tosph570.apps.googleusercontent.com",
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
    console.warn(`Unknown environment: ${env}, falling back to dev`);
    return firebaseConfigs.dev;
  }

  return config;
};

const firebaseConfig = getFirebaseConfig();
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export { app, firebaseConfig };
