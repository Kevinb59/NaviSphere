// 1) Purpose:
// - Persister les favoris en local quand `VITE_GAS_WEB_APP_URL` n'est pas configuré (développement hors GAS).
// 2) Key variables:
// - Clé `navisphere_favs_<alias>` dans localStorage (tableau JSON d’ids services / slugs, max 24).
// 3) Logic flow:
// - Lecture / écriture sérialisées; en cas d'erreur JSON, retourner un tableau vide.

const PREFIX = 'navisphere_favs_';

export function loadLocalFavorites(alias: string): string[] {
  try {
    const raw = localStorage.getItem(PREFIX + alias);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function saveLocalFavorites(alias: string, favorites: string[]) {
  localStorage.setItem(PREFIX + alias, JSON.stringify(favorites.slice(0, 24)));
}
