import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "homegeekdemo",
  appId: "1:321433914812:web:d30bdb093dee72fb2d2fb9",
  storageBucket: "homegeekdemo.firebasestorage.app",
  apiKey: "AIzaSyC44gkEIt19KV51Y2cMlOJ9F9WepblX8sI",
  authDomain: "homegeekdemo.firebaseapp.com",
  messagingSenderId: "321433914812",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

export { app, auth, storage, db };
