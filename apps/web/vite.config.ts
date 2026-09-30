/**
 * Configuration de construction de l'interface (Vite).
 *
 * Règles : EXG-WEB-002 (JavaScript initial ≤ 300 ko compressé), RI-SEC-06 (aucun script en ligne).
 */
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8080', '/healthz': 'http://127.0.0.1:8080' } },
});
