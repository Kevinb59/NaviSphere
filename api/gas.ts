import type { VercelRequest, VercelResponse } from '@vercel/node';

// 1) Purpose:
// - Proxy Node.js (runtime par défaut Vercel, pas Edge) vers l’URL /exec GAS.
// - L’Edge peut recevoir un 403 côté Google sans exécuter doPost (aucun log GAS).
// 2) Key variables:
// - `process.env.GAS_WEB_APP_URL` ou `VITE_GAS_WEB_APP_URL` : URL complète /exec.
// - `req.body` : corps JSON parsé par Vercel quand le client envoie application/json.
// 3) Logic flow:
// - Vérif POST → relire l’URL GAS → reconstruire le corps JSON en string → POST text/plain vers GAS → renvoyer la réponse brute.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const gasUrl =
    process.env.GAS_WEB_APP_URL?.trim() ||
    process.env.VITE_GAS_WEB_APP_URL?.trim();
  if (!gasUrl) {
    res.status(500).json({ ok: false, error: 'GAS_URL_MISSING' });
    return;
  }

  const bodyStr =
    typeof req.body === 'string'
      ? req.body
      : Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body ?? {});

  const upstream = await fetch(gasUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      Accept: 'application/json, text/plain, */*',
      'User-Agent':
        'Mozilla/5.0 (compatible; NaviSphere/1.0; +https://github.com/Kevinb59/NaviSphere)',
    },
    body: bodyStr,
  });

  const text = await upstream.text();
  res.status(upstream.status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(text);
}
