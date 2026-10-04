import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const api = env.VITE_API_URL || 'http://localhost:8000';

  return {
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
      // Se sirve en /admin. `base` relativo para que funcione tanto en un
      // subdirectorio como en la raíz de un dominio propio.
      outDir: 'dist',
      sourcemap: mode !== 'production',
    },
  };
});
