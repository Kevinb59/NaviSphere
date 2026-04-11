// 1) Purpose:
// - Initialiser une seule instance Firebase (Auth + Firestore) à partir des variables Vite.
// 2) Key variables:
// - `app` : instance mise en cache ; `getApps()` évite le double `initializeApp` en HMR.
// 3) Logic flow:
// - Si une clé requise manque → pas d’init ; sinon `initializeApp` + accesseurs `getAuth` / `getFirestore`.

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// 1) Purpose:
// - Savoir si le site peut initialiser Firebase (variables Vite présentes).
// 2) Key variables: champs obligatoires du snippet « Ajouter une application Web ».
// 3) Logic flow: toutes les chaînes non vides → true.
export function isFirebaseConfigured(): boolean {
  const k = import.meta.env.VITE_FIREBASE_API_KEY;
  const d = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const p = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const a = import.meta.env.VITE_FIREBASE_APP_ID;
  return Boolean(String(k || '').trim() && String(d || '').trim() && String(p || '').trim() && String(a || '').trim());
}

let cachedApp: FirebaseApp | null = null;

// 1) Purpose:
// - Retourner l’app Firebase ou null si la config est absente / invalide.
// 2) Key variables: `cachedApp` pour mémoriser l’instance.
// 3) Logic flow: `isFirebaseConfigured` → construire `firebaseConfig` → réutiliser `getApps()[0]` si présent.
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (cachedApp) return cachedApp;
  const firebaseConfig = {
    apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY).trim(),
    authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN).trim(),
    projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID).trim(),
    storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim() || undefined,
    messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim() || undefined,
    appId: String(import.meta.env.VITE_FIREBASE_APP_ID).trim(),
    measurementId: String(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '').trim() || undefined,
  };
  const existing = getApps();
  cachedApp = existing.length > 0 ? existing[0]! : initializeApp(firebaseConfig);
  return cachedApp;
}

// 1) Purpose:
// - Exposer Auth pour connexion / écoute de session.
// 2) Key variables: dépend de `getFirebaseApp()`.
// 3) Logic flow: pas d’app → null ; sinon `getAuth(app)`.
export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

// 1) Purpose:
// - Exposer Firestore pour lire/écrire les favoris du dock.
// 2) Key variables: même app que Auth.
// 3) Logic flow: pas d’app → null ; sinon `getFirestore(app)`.
export function getFirestoreDb(): Firestore | null {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
}
