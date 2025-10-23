import { initializeApp, getApps, getApp } from "firebase/app";

const firebaseConfig = {
  projectId: "goggle-gab",
  appId: "1:899405062685:web:85f754bca5f285613bdcf4",
  storageBucket: "goggle-gab.firebasestorage.app",
  apiKey: "AIzaSyBboitYJHU4M0VD0vJ9TZaAzNygbqtOcjs",
  authDomain: "goggle-gab.firebaseapp.com",
  messagingSenderId: "899405062685",
  webClientId:
    "899405062685-610190h96u4l4s717v2h91f4229h7i.apps.googleusercontent.com", // For web, if needed
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export { app, firebaseConfig };
