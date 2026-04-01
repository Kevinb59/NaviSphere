// 1) Purpose:
// - Appeler GAS via le proxy `/api/gas` (même origine) pour éviter le blocage CORS navigateur → script.google.com.
// 2) Key variables:
// - `VITE_GAS_WEB_APP_URL` : utilisée pour `isGasConfigured` et pour le proxy de dev Vite (pas pour fetch direct en prod).
// 3) Logic flow:
// - `gasFetch` POST sur `/api/gas` (ou proxy local en dev) ; le serveur relaie vers l’URL GAS.

export type GasAuthResponse = { ok: true; favorites: string[] } | { ok: false; error: string };

// 1) Purpose:
// - Traduire les codes / messages renvoyés par GAS en texte lisible (feuille manquante, champs, etc.).
// 2) Key variables: `error` = chaîne brute ; `mode` = login ou register pour les libellés par défaut.
// 3) Logic flow: codes connus → message court ; sinon renvoyer le message GAS (tronqué si très long).
export function formatGasAuthMessage(error: string, mode: 'login' | 'register'): string {
  const e = error.trim();
  if (e === 'CHAMPS_MANQUANTS') {
    return 'Renseigne un alias et un mot de passe.';
  }
  if (
    e.includes('FEUILLE_MANQUANTE') ||
    e.includes('SPREADSHEET_ID') ||
    e.includes('définis SPREADSHEET_ID') ||
    e.includes('getActiveSpreadsheet')
  ) {
    return 'Accès au tableur : dans Google Apps Script → Paramètres du projet → Propriétés du script, ajoute SPREADSHEET_ID (l’ID dans l’URL de ta feuille), puis redéploie l’application web.';
  }
  if (mode === 'register') {
    if (e === 'ALIAS_EXISTE') return 'Cet alias est déjà utilisé.';
    if (e.length <= 200) return e || 'Inscription impossible.';
    return `${e.slice(0, 197)}…`;
  }
  if (e === 'UTILISATEUR_INCONNU') return 'Alias inconnu.';
  if (e === 'MOT_DE_PASSE_INVALIDE') return 'Mot de passe incorrect.';
  if (e.length <= 200) return e || 'Connexion impossible.';
  return `${e.slice(0, 197)}…`;
}

function getGasUrl(): string | undefined {
  const url = import.meta.env.VITE_GAS_WEB_APP_URL;
  return url && String(url).trim() ? String(url).trim() : undefined;
}

export function isGasConfigured(): boolean {
  return Boolean(getGasUrl());
}

// 1) Purpose:
// - Construire le chemin `/api/gas` (ou `/base/api/gas`) pour le proxy même-origine.
// 2) Key variables:
// - `import.meta.env.BASE_URL` : préfixe Vite si déploiement sous sous-chemin.
// 3) Logic flow:
// - Préfixe sans double slash ; toujours relatif au site pour éviter CORS.
function getGasProxyUrl(): string {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const prefix = baseUrl === '/' ? '' : baseUrl.replace(/\/$/, '');
  return `${prefix}/api/gas`.replace(/\/+/g, '/');
}

export async function gasFetch<T>(body: Record<string, unknown>): Promise<T> {
  if (!getGasUrl()) {
    throw new Error('VITE_GAS_WEB_APP_URL non configurée (voir web/.env.example).');
  }

  // 1) Purpose:
  // - application/json : Vercel parse req.body côté fonction Node ; le proxy relaie en text/plain vers GAS (JSON.parse dans doPost).
  // 2) Key variables: `body` = payload { action, ... }.
  // 3) Logic flow: POST JSON → proxy Node → GAS.
  const response = await fetch(getGasProxyUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const trimmed = text.trim();

  // 1) Purpose:
  // - Éviter JSON.parse sur du HTML (SPA index.html, 403/502 Vercel) → erreur « Unexpected token '<' ».
  // 2) Key variables: `trimmed` = corps texte de la réponse.
  // 3) Logic flow: si ça ressemble à du HTML → message explicite ; sinon parse JSON.
  if (trimmed.startsWith('<') || trimmed.startsWith('<!')) {
    throw new Error(
      'Le serveur a renvoyé une page HTML au lieu de JSON (souvent /api/gas indisponible ou cache Vercel). Réessaie dans quelques secondes.',
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      `Réponse invalide (pas du JSON). HTTP ${response.status}. Début : ${trimmed.slice(0, 60)}…`,
    );
  }
}

// 1) Purpose:
// - Envoyer le secret sous la clé `pwd` (pas `password`) pour limiter les faux positifs WAF / pare-feu sur POST JSON.
// 2) Key variables: `payload.password` reste l’API TypeScript côté app ; le réseau transporte `pwd`.
// 3) Logic flow: construire l’objet JSON avec alias + pwd (+ favorites si besoin) → gasFetch.
export async function gasRegister(payload: {
  alias: string;
  password: string;
}): Promise<GasAuthResponse> {
  return gasFetch<GasAuthResponse>({
    action: 'register',
    alias: payload.alias,
    pwd: payload.password,
  });
}

export async function gasLogin(payload: {
  alias: string;
  password: string;
}): Promise<GasAuthResponse> {
  return gasFetch<GasAuthResponse>({
    action: 'login',
    alias: payload.alias,
    pwd: payload.password,
  });
}

export async function gasSetFavorites(payload: {
  alias: string;
  password: string;
  favorites: string[];
}): Promise<GasAuthResponse> {
  return gasFetch<GasAuthResponse>({
    action: 'setFavorites',
    alias: payload.alias,
    pwd: payload.password,
    favorites: payload.favorites,
  });
}
