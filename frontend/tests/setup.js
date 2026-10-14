import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// findBy*/waitFor esperan hasta 5 s (por defecto 1 s): en equipos lentos o con otras suites corriendo
// en paralelo, jsdom tarda más que eso en pintar modales grandes y daba fallos intermitentes.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    /* jsdom siempre lo permite; por si cambia el entorno */
  }
});
