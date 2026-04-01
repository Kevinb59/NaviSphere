// 1) Purpose:
// - Proxy serveur vers l’URL /exec Google Apps Script pour contourner le blocage CORS du navigateur.
// 2) Key variables:
// - `VITE_GAS_WEB_APP_URL` ou `GAS_WEB_APP_URL` : URL complète du déploiement GAS (variables Vercel).
// 3) Logic flow:
// - POST entrant → même corps en text/plain vers GAS → réponse JSON renvoyée au client (même origine que le site).

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const gasUrl =
    process.env.GAS_WEB_APP_URL?.trim() ||
    process.env.VITE_GAS_WEB_APP_URL?.trim();
  if (!gasUrl) {
    return new Response(JSON.stringify({ ok: false, error: 'GAS_URL_MISSING' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const body = await request.text();

  const upstream = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
