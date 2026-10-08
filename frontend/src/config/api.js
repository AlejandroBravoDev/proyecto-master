/**
 * Dynamic API Base URL resolver.
 * - Electron Desktop Shell: resolves via window.electronAPI
 * - Web Production (VPS / Cloud / Domain): returns '' (relative URLs like /api/...)
 * - Web Development (Vite dev server): uses VITE_API_URL or defaults to http://localhost:3001
 */
export const getApiBaseUrl = () => {
  // 1. Entorno de escritorio Electron
  if (typeof window !== 'undefined' && window.electronAPI) {
    if (typeof window.electronAPI.getApiUrl === 'function') {
      const url = window.electronAPI.getApiUrl();
      if (url) return url;
    }
    if (window.electronAPI.apiUrl) {
      return window.electronAPI.apiUrl;
    }
  }

  // 2. Si se definió explícitamente una variable de entorno en .env
  if (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '') {
    return import.meta.env.VITE_API_URL;
  }

  // 3. Entorno Web en Producción (Dominio / VPS / Servidor)
  // Cadena vacía para que todas las llamadas sean relativas al mismo dominio (/api/...)
  // evitando problemas de CORS, Mixed Content o errores con localhost en otros dispositivos.
  if (import.meta.env.PROD) {
    return '';
  }

  // 4. Entorno de desarrollo local (Vite dev server en localhost:5173 hacia backend en :3001)
  return 'http://localhost:3001';
};

