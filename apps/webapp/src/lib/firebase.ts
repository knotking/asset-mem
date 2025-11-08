import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "goggle-gab",
  "appId": "1:899405062685:web:85f754bca5f285613bdcf4",
  "storageBucket": "goggle-gab.firebasestorage.app",
  "apiKey": "AIzaSyBboitYJHU4M0VD0vJ9TZaAzNygbqtOcjs",
  "authDomain": "goggle-gab.firebaseapp.com",
  "messagingSenderId": "899405062685"
};


const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

export { app, auth, storage, db };
