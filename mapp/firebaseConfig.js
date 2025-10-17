import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBboitYJHU4M0VD0vJ9TZaAzNygbqtOcjs',
  authDomain: 'goggle-gab.firebaseapp.com',
  projectId: 'goggle-gab',
  storageBucket: 'goggle-gab.firebasestorage.app',
  messagingSenderId: '899405062685',
  appId: '1:899405062685:web:85f754bca5f285613bdcf4',
  webClientId: '899405062685-610190h96u4l4s717v2h91f4229h7i.apps.googleusercontent.com', // Replace with your web client ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, firebaseConfig };
