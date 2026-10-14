import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Configuración de pruebas del frontend (Vitest + Testing Library + jsdom).
// Las pruebas viven en frontend/tests (espejo de src/app) para no mezclarse con el build.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    css: false,
    restoreMocks: true,
    // Margen para equipos lentos o con otras suites corriendo en paralelo (los modales grandes tardan en jsdom).
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/renderer.jsx'],
      reporter: ['text-summary', 'text'],
    },
  },
});
