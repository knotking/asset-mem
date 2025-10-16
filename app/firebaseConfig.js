import { initializeApp, getApps, getApp } from "firebase/app";

import { getAuth, initializeAuth } from "firebase/auth";

import { getFirestore } from "firebase/firestore";
// @ts-ignore
import { getReactNativePersistence } from "@firebase/auth/dist/rn/index.js";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyBboitYJHU4M0VD0vJ9TZaAzNygbqtOcjs",
  authDomain: "goggle-gab.firebaseapp.com",
  projectId: "goggle-gab",
  storageBucket: "goggle-gab.firebasestorage.app",
  messagingSenderId: "899405062685",
  appId: "1:899405062685:web:85f754bca5f285613bdcf4",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
const db = getFirestore(app);

export { auth, db };
