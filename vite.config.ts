import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const rawBase = process.env.BASE_URL || process.env.PUBLIC_URL || env.BASE_URL || env.PUBLIC_URL || './';
  const base = rawBase === './' ? './' : (rawBase.endsWith('/') ? rawBase : `${rawBase}/`);

  return {
    base,
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: true,
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3004,
      strictPort: true,
      hmr: false
    },
  };
});
