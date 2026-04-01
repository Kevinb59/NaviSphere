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

Le proxy **`api/gas.ts`** utilise le **runtime Node.js** (`@vercel/node`), pas **Edge** : certains appels vers `script.google.com` depuis l’Edge ne déclenchent pas `doPost` (aucun log GAS) et peuvent renvoyer **403**.

**Build Vercel :** pas de **npm workspaces** entre la racine et `web/` (sinon les binaires optionnels de **Rolldown** / Vite 8 peuvent manquer sur Linux). Le `vercel.json` exécute `npm install` à la racine puis `cd web && npm install` ; `@vercel/node` est déclaré à la racine (pour `api/gas.ts`) et dans `web/package.json` (pour `web/api/gas.ts`).

**Mot de passe sur le réseau :** le client envoie `pwd` (pas la clé `password`) pour limiter les **403** sur **POST** `/api/gas` déclenchés par certains **pare-feu / WAF** (faux positifs sur le mot « password » dans le JSON). Le script GAS doit utiliser `readPassword_(data)` (`password` ou `pwd`) — voir `example/Code.gs`.

**Diagnostic :** ouvre `GET /api/gas` sur ton domaine : réponse JSON `{ ok: true, ping: true }` et en-tête `X-NaviSphere-Proxy: 1` si la fonction serverless répond. Si **GET** est déjà en **403**, vérifie **Vercel → Security** (protection du déploiement, pare-feu).

### Feuille Google : aucune ligne ajoutée alors que l’exécution GAS se termine

Souvent le projet Apps Script est **autonome** (créé depuis script.google.com) : en **Application Web**, `getActiveSpreadsheet()` **n’a pas de classeur actif**, l’erreur est attrapée et l’UI affiche « Inscription impossible » sans rien écrire.

**À faire :** dans **Projet Google Apps Script → Paramètres du projet (engrenage) → Propriétés du script**, ajoute une propriété **`SPREADSHEET_ID`** = l’identifiant du tableur (dans l’URL : `https://docs.google.com/spreadsheets/d/`**`CET_ID`**`/edit`). Puis **redéploie** l’application web.

**Alternative :** ouvre **Extensions → Apps Script** **depuis la feuille** (script lié au classeur) : dans ce cas `SPREADSHEET_ID` n’est pas obligatoire.

Dans `example/Code.gs`, **`DEFAULT_SPREADSHEET_ID`** peut contenir ton ID en secours si tu ne veux pas passer par les propriétés du script ; mets-le à `''` si tu publies un fork sans ton classeur.

**Où sont les données ?** Le script écrit dans **la première feuille** du classeur (premier onglet à gauche). Si tu regardes un autre onglet, la feuille semblera « vide ».

**Côté site web :** l’alias et le mot de passe sont aussi stockés dans **`sessionStorage`** du navigateur (session courante). Les favoris peuvent être dupliqués dans **`localStorage`** (`navisphere_favs_<alias>`) en secours si le proxy `/api/gas` ou GAS répond parfois en HTML au lieu de JSON.

En **développement local**, Vite proxy `/api/gas` vers cette même URL (voir `web/vite.config.ts`).

Le corps reste en `Content-Type: text/plain` vers GAS, comme dans `example/Code.gs`.
