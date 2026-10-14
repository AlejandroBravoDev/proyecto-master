/**
 * ====================================================
 * SEGURIDAD HTTP: CORS, CSP (helmet) Y TRUST PROXY
 * ====================================================
 * Configuración pura (recibe el entorno por parámetro) para poder probarla sin
 * tocar process.env. app.ts la monta al crear la app.
 *
 * Variables de entorno:
 *   FRONTEND_URL      lista separada por comas de orígenes que pueden llamar a la API desde
 *                     un navegador (p. ej. http://localhost:5173,https://pos.midominio.com).
 *   TRUST_PROXY       cuántos proxies hay delante (número), `true`/`false` o lista de IPs/subredes.
 *                     Por defecto 1 con NODE_ENV=production (Railway/Render) y desactivado en dev/test.
 *   CSP_REPORT_ONLY   `true` => la CSP se envía como Content-Security-Policy-Report-Only
 *                     (el navegador avisa en consola pero no bloquea). Interruptor de emergencia.
 */

import type { CorsOptions } from 'cors';
import type { HelmetOptions } from 'helmet';

export type CorsMode =
  /** FRONTEND_URL definida: solo esos orígenes. */
  | 'list'
  /** Producción sin FRONTEND_URL: nadie más que el mismo origen. */
  | 'same-origin'
  /** Desarrollo/pruebas sin FRONTEND_URL: solo localhost/127.0.0.1/[::1] en cualquier puerto. */
  | 'localhost';

export interface CorsPolicy {
  mode: CorsMode;
  /** Orígenes normalizados de FRONTEND_URL (vacío si mode != 'list'). */
  origins: string[];
}

/** Normaliza un origen: quita rutas y barras finales (`https://x.com/` -> `https://x.com`) y baja a minúsculas. */
function normalizeOrigin(raw: string): string {
  const trimmed = raw.trim();
  try {
    const { origin } = new URL(trimmed);
    // Textos sin esquema (p. ej. "localhost:5173") se parsean como esquema opaco: origin === 'null'.
    if (origin !== 'null') return origin.toLowerCase();
  } catch {
    // no es una URL: se compara tal cual
  }
  return trimmed.replace(/\/+$/, '').toLowerCase();
}

/** Convierte FRONTEND_URL ("a, b") en una lista de orígenes normalizados, sin vacíos ni repetidos. */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  const list = raw
    .split(',')
    .map(normalizeOrigin)
    .filter((origin) => origin !== '');
  return Array.from(new Set(list));
}

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i;

/** true para http(s)://localhost, 127.0.0.1 o [::1] con cualquier puerto. */
export function isLocalOrigin(origin: string): boolean {
  return LOCAL_ORIGIN.test(origin);
}

/** Decide la política CORS a partir del entorno. */
export function resolveCorsPolicy(env: NodeJS.ProcessEnv = process.env): CorsPolicy {
  const origins = parseAllowedOrigins(env.FRONTEND_URL);
  if (origins.length > 0) return { mode: 'list', origins };
  return { mode: env.NODE_ENV === 'production' ? 'same-origin' : 'localhost', origins: [] };
}

/**
 * Opciones de `cors`. Nunca se refleja un origen no autorizado ni se envía `*`:
 * un origen denegado simplemente no recibe cabeceras CORS y el navegador bloquea la lectura.
 * `onDenied` se llama (con el origen) cuando se rechaza uno, para registrarlo.
 */
export function buildCorsOptions(policy: CorsPolicy, onDenied?: (origin: string) => void): CorsOptions {
  const common = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  };

  if (policy.mode === 'same-origin') {
    // Sin FRONTEND_URL en producción no se abre CORS: el SPA servido por este mismo backend
    // llama a /api con el mismo origen y no necesita cabeceras CORS.
    return { ...common, origin: false };
  }

  const allowed = new Set(policy.origins);
  const isAllowed = (origin: string): boolean =>
    policy.mode === 'list' ? allowed.has(origin.toLowerCase()) : isLocalOrigin(origin);

  return {
    ...common,
    origin: (origin, callback) => {
      // Sin cabecera Origin (mismo origen, curl, apps nativas): CORS no interviene.
      if (!origin) return callback(null, false);
      if (isAllowed(origin)) return callback(null, true);
      onDenied?.(origin);
      return callback(null, false);
    },
  };
}

/**
 * Valor para `app.set('trust proxy', ...)`.
 *  - Sin TRUST_PROXY: 1 en producción (un proxy delante: Railway/Render), false en dev/test.
 *  - "false"/"0": desactivado. "true": confía en todo (INSEGURO: permite falsear la IP).
 *  - Entero N: confía en los N proxies más cercanos. Otro texto: IPs/subredes/alias de Express.
 */
export function resolveTrustProxy(env: NodeJS.ProcessEnv = process.env): boolean | number | string {
  const raw = (env.TRUST_PROXY ?? '').trim();
  if (raw === '') return env.NODE_ENV === 'production' ? 1 : false;
  const lower = raw.toLowerCase();
  if (lower === 'false') return false;
  if (lower === 'true') return true;
  if (/^\d+$/.test(raw)) {
    const hops = Number(raw);
    return hops === 0 ? false : hops;
  }
  return raw;
}

/**
 * Directivas de Content-Security-Policy compatibles con el frontend compilado (Vite + React + Tailwind):
 *  - script-src 'self': el bundle de módulos es propio, no hay scripts inline.
 *  - style-src 'unsafe-inline' + Google Fonts: SweetAlert2 y atributos style de React inyectan estilos inline.
 *  - font-src: archivos de fuente de fonts.gstatic.com (y data:).
 *  - img-src: imágenes de producto pueden ser URLs https externas, data: o blob:.
 *  - connect-src 'self' + FRONTEND_URL: llamadas a la API.
 *  - Sin `upgrade-insecure-requests`: el POS puede servirse por HTTP en una red local y esa
 *    directiva forzaría https en las llamadas a /api, rompiéndolas.
 */
export function buildCspDirectives(frontendOrigins: string[] = []): Record<string, string[]> {
  return {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'script-src': ["'self'"],
    'script-src-attr': ["'none'"],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'connect-src': ["'self'", ...frontendOrigins],
    'object-src': ["'none'"],
    'frame-ancestors': ["'self'"],
    'form-action': ["'self'"],
  };
}

/** Opciones de helmet: cabeceras seguras + CSP (en modo solo-informe si CSP_REPORT_ONLY=true). */
export function buildHelmetOptions(env: NodeJS.ProcessEnv = process.env): HelmetOptions {
  const policy = resolveCorsPolicy(env);
  const reportOnly = (env.CSP_REPORT_ONLY ?? '').trim().toLowerCase() === 'true';
  return {
    contentSecurityPolicy: {
      useDefaults: false,
      reportOnly,
      directives: buildCspDirectives(policy.origins),
    },
  };
}
