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

## CORS et proxy Vercel

Les navigateurs **bloquent** les appels directs depuis ton site (ex. `*.vercel.app`) vers `script.google.com` : il manque l’en-tête `Access-Control-Allow-Origin` sur la réponse GAS.

Le frontend appelle donc **`/api/gas`** sur **le même domaine** que le site ; la fonction serverless **`api/gas.ts`** (à la **racine du dépôt Git**, à côté de `web/`) relaie la requête vers l’URL `/exec`. Sur Vercel, définis **`VITE_GAS_WEB_APP_URL`** (ou **`GAS_WEB_APP_URL`**) avec l’URL `/exec` — le proxy lit ces variables côté serveur.

**Important :** le dépôt contient **`api/gas.ts`** (racine) et **`web/api/gas.ts`** (doublon). Si Vercel a **Root Directory** = racine du repo, c’est la première qui est utilisée ; si la racine est **`web`** (souvent auto-détecté pour Vite), seule **`web/api/gas.ts`** est déployée — les deux fichiers sont alignés pour couvrir les deux cas.

Le **rewrite** SPA dans `vercel.json` utilise `/((?!api/).*)` → `index.html` pour éviter qu’un `POST /api/gas` soit confondu avec la page HTML (souvent **403** sur Vercel).

En **développement local**, Vite proxy `/api/gas` vers cette même URL (voir `web/vite.config.ts`).

Le corps reste en `Content-Type: text/plain` vers GAS, comme dans `example/Code.gs`.
