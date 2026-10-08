/**
 * Dynamic API Base URL resolver for Web Application.
 * - Web Production (Railway / VPS / Cloud): returns '' (relative URLs: /api/...)
 * - Web Development (Vite dev server): uses VITE_API_URL or defaults to http://localhost:3001
 */
export const getApiBaseUrl = () => {
  // 1. Si se definió explícitamente una variable de entorno en .env (ej: VITE_API_URL)
  if (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '') {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }

  // 2. Entorno Web en Producción (Railway / VPS / Dominio en la nube)
  // Cadena vacía para que todas las llamadas sean relativas al mismo host (/api/...)
  // evitando problemas de CORS, Mixed Content o errores de llamadas a localhost en clientes remotos.
  if (import.meta.env.PROD) {
    return '';
  }

  // 3. Entorno de desarrollo local (Vite dev server en localhost:5173 apuntando a backend en :3001)
  return 'http://localhost:3001';
};

