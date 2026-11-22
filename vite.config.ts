import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const api = env.VITE_API_URL || 'http://127.0.0.1:8001';
  // '/' para sitio en raíz (ej. Netlify). '/admin/' para servir bajo subruta.
  const base = env.VITE_BASE || '/';

  return {
    base,

    plugins: [react(), tailwindcss()],

    server: {
      port: 3001,
      proxy: {
        // La API del panel: /api/token/ y /api/admin/*
        '/api': { target: api, changeOrigin: true, secure: false },
        // Archivos subidos desde el panel (MEDIA_URL del backend).
        '/media': { target: api, changeOrigin: true, secure: false },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
    },
  };
});
