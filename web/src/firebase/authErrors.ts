// 1) Purpose:
// - Afficher des messages d’erreur Firebase Auth en français dans les formulaires.
// 2) Key variables: codes `auth/*` renvoyés par le SDK.
// 3) Logic flow: `instanceof Error` + `code` → message court ; sinon message générique.

// 1) Purpose:
// - Traduire une exception Firebase (ou réseau) en texte utilisateur.
// 2) Key variables: `err` capturé après `signInWithEmailAndPassword` / `createUserWithEmailAndPassword`.
// 3) Logic flow: inspection de `(err as { code?: string }).code` puis fallback.
export function formatFirebaseAuthError(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: string }).code) : '';
  if (code === 'auth/invalid-email') return 'Adresse e-mail invalide.';
  if (code === 'auth/user-disabled') return 'Ce compte a été désactivé.';
  if (code === 'auth/user-not-found') return 'Aucun compte pour cet e-mail.';
  if (code === 'auth/wrong-password') return 'Mot de passe incorrect.';
  if (code === 'auth/invalid-credential') return 'E-mail ou mot de passe incorrect.';
  if (code === 'auth/email-already-in-use') return 'Un compte existe déjà avec cet e-mail.';
  if (code === 'auth/weak-password') return 'Mot de passe trop faible (minimum 6 caractères).';
  if (code === 'auth/too-many-requests') return 'Trop de tentatives. Réessayez plus tard.';
  if (code === 'auth/network-request-failed') return 'Problème réseau. Vérifiez la connexion.';
  if (err instanceof Error && err.message) return err.message.length <= 220 ? err.message : `${err.message.slice(0, 217)}…`;
  return 'Connexion ou inscription impossible. Réessayez.';
}
