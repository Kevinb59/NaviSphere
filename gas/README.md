# Google Apps Script — NaviSphere

Ce dossier documente le backend **Google Apps Script** lié à votre feuille Google Sheet (colonnes **A–Z** : `Alias`, `MDP`, `App1`…`App24`).

## Déploiement

1. Ouvrez la feuille Google Sheet, puis **Extensions → Apps Script**.
2. Collez le contenu de `example/Code.gs` dans l’éditeur (ou divisez en plusieurs fichiers `.gs` si vous préférez).
3. Déployez comme **Application Web** :
   - Exécuter en tant que : vous
   - Accès : **Tous** (ou utilisateurs autorisés selon votre besoin)
4. Copiez l’URL se terminant par `/exec` et définissez-la dans Vercel (ou localement) :

   `VITE_GAS_WEB_APP_URL=https://script.google.com/macros/s/.../exec`

## Feuille

- **Ligne 1** : en-têtes `Alias`, `MDP`, `App1`, …, `App24`
- **Lignes suivantes** : une ligne par utilisateur ; les favoris sont les **noms exacts** des services tels qu’affichés dans NaviSphere (ex. `Netflix`, `Spotify`).

## Sécurité

Les mots de passe sont stockés **en clair** dans la feuille : convenable pour un prototype, pas pour des données sensibles. Prévoyez un hachage côté script ou un autre backend si besoin.

## CORS

Le client envoie le corps en `Content-Type: text/plain` pour limiter les problèmes de préflight avec les Web Apps GAS.
