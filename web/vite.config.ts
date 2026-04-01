import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gasUrl = env.VITE_GAS_WEB_APP_URL?.trim();

  return {
    plugins: [react(), tailwindcss()],
    // 1) Purpose:
    // - En dev, `/api/gas` n’existe pas côté Vite : on relaie vers l’URL GAS (comme le proxy Vercel en prod).
    // 2) Key variables:
    // - `VITE_GAS_WEB_APP_URL` : lue depuis `.env.local` à la racine de `web/`.
    // 3) Logic flow:
    // - `target` = origine script.google.com ; `rewrite` remplace le chemin par celui du déploiement /exec.
    server: {
      proxy: gasUrl
        ? {
            '/api/gas': {
              target: new URL(gasUrl).origin,
              changeOrigin: true,
              rewrite: () => new URL(gasUrl).pathname + new URL(gasUrl).search,
            },
          }
        : undefined,
    },
  };
});
