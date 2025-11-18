import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";

const firebaseConfig = {
  projectId: "homegeekdemo",
  appId: "1:321433914812:web:d30bdb093dee72fb2d2fb9",
  storageBucket: "homegeekdemo.firebasestorage.app",
  apiKey: "AIzaSyC44gkEIt19KV51Y2cMlOJ9F9WepblX8sI",
  authDomain: "homegeekdemo.firebaseapp.com",
  messagingSenderId: "321433914812",
  webClientId:
    "321433914812-898vs8tgasfvko1c9o71cdk0tosph570.apps.googleusercontent.com",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export { app, firebaseConfig };
