import { app, firebaseConfig } from "./firebase-config";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirestore, type Firestore } from "firebase/firestore";
import type { FirebaseApp } from "firebase/app";

const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);
const db: Firestore = getFirestore(app);

export { app, auth, storage, db, firebaseConfig };
export type { Auth, FirebaseStorage, Firestore, FirebaseApp };
