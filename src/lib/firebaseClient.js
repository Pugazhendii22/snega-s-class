import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
};

const requiredConfig = ['apiKey', 'authDomain', 'projectId', 'appId'];
export const firebaseConfigured = requiredConfig.every((key) => firebaseConfig[key].trim().length > 0);
export const demoMode = import.meta.env.VITE_DEMO_MODE !== 'false' || !firebaseConfigured;

let client = null;
if (!demoMode) {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  client = { app, auth, db, googleProvider };
}

export function getFirebaseClient() {
  return client;
}

export function watchTeacherAuth(onUser, onError) {
  if (!client) throw new Error('Firebase is not connected. Demo mode is active.');
  return onAuthStateChanged(client.auth, onUser, onError);
}

export async function signInTeacherWithGoogle() {
  if (!client) throw new Error('Firebase is not connected. Demo mode is active.');
  const result = await signInWithPopup(client.auth, client.googleProvider);
  return result.user;
}

export async function signOutTeacher() {
  if (!client) throw new Error('Firebase is not connected. Demo mode is active.');
  await signOut(client.auth);
}

export async function isApprovedTeacher(user) {
  if (!client || !user?.uid) return false;
  const snapshot = await getDoc(doc(client.db, 'teachers', user.uid));
  return snapshot.exists() && snapshot.data().active === true;
}
