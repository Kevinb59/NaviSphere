// 1) Purpose:
// - Persister l’ordre des favoris du dock dans Firestore : `users/{uid}/settings/dock`.
// 2) Key variables:
// - Champ `favoriteIds` : tableau d’ids catalogue (slugs), ordre = ordre d’affichage, max 24.
// - `updatedAt` : horodatage serveur pour debug / futures synchros.
// 3) Logic flow:
// - `loadDockFavoriteIds` : `getDoc` → tableau vide si document absent.
// - `saveDockFavoriteIds` : `setDoc` avec `merge` pour créer ou mettre à jour sans écraser d’autres champs futurs.

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirestoreDb } from './client';

// 1) Purpose:
// - Lire les ids favoris pour l’utilisateur connecté (`uid` = Firebase Auth).
// 2) Key variables: `favoriteIds` dans le document `settings/dock`.
// 3) Logic flow: pas de DB → [] ; pas de doc → [] ; sinon normalisation en `string[]`.
export async function loadDockFavoriteIds(uid: string): Promise<string[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  const ref = doc(db, 'users', uid, 'settings', 'dock');
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const raw = snap.data().favoriteIds as unknown;
  return Array.isArray(raw) ? raw.map(String) : [];
}

// 1) Purpose:
// - Enregistrer tout l’ordre du dock d’un coup (après édition, ajout hors mode édition, etc.).
// 2) Key variables: `ids` déjà bornés côté appelant ; on tronque à 24 ici aussi.
// 3) Logic flow: `setDoc(..., { merge: true })` pour ne pas supprimer d’éventuels champs ajoutés plus tard.
export async function saveDockFavoriteIds(uid: string, ids: string[]): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponible.');
  const ref = doc(db, 'users', uid, 'settings', 'dock');
  await setDoc(
    ref,
    {
      favoriteIds: ids.slice(0, 24),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
