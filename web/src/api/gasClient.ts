// 1) Purpose:
// - Appeler l'application Web Google Apps Script (POST JSON en text/plain pour limiter les soucis CORS).
// 2) Key variables:
// - `GAS_URL`: URL `/exec` définie dans l'environnement Vite.
// 3) Logic flow:
// - `gasFetch` sérialise le corps, parse la réponse JSON, propage les erreurs réseau.

export type GasAuthResponse = { ok: true; favorites: string[] } | { ok: false; error: string };

function getGasUrl(): string | undefined {
  const url = import.meta.env.VITE_GAS_WEB_APP_URL;
  return url && String(url).trim() ? String(url).trim() : undefined;
}

export function isGasConfigured(): boolean {
  return Boolean(getGasUrl());
}

export async function gasFetch<T>(body: Record<string, unknown>): Promise<T> {
  const url = getGasUrl();
  if (!url) {
    throw new Error('VITE_GAS_WEB_APP_URL non configurée (voir web/.env.example).');
  }

  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  return JSON.parse(text) as T;
}

export async function gasRegister(payload: {
  alias: string;
  password: string;
}): Promise<GasAuthResponse> {
  return gasFetch<GasAuthResponse>({ action: 'register', ...payload });
}

export async function gasLogin(payload: {
  alias: string;
  password: string;
}): Promise<GasAuthResponse> {
  return gasFetch<GasAuthResponse>({ action: 'login', ...payload });
}

export async function gasSetFavorites(payload: {
  alias: string;
  password: string;
  favorites: string[];
}): Promise<GasAuthResponse> {
  return gasFetch<GasAuthResponse>({ action: 'setFavorites', ...payload });
}
