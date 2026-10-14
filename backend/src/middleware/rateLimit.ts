/**
 * ====================================================
 * LÍMITES DE TASA (RATE LIMITING)
 * ====================================================
 * Dos limitadores independientes, ambos por IP:
 *  - login: estricto, cuenta solo intentos FALLIDOS (un login correcto no consume cupo).
 *  - api:   global y holgado para /api. En un restaurante todas las tablets comparten IP,
 *           así que el uso normal nunca debe acercarse al límite.
 *
 * Todo se configura por variables de entorno LEÍDAS AL CREAR LA APP (no al importar el
 * módulo), de modo que las pruebas pueden inyectar su propia configuración:
 *   RATE_LIMIT_LOGIN_MAX         intentos fallidos de login por ventana   (10)
 *   RATE_LIMIT_LOGIN_WINDOW_MS   ventana del login en ms                  (900000 = 15 min)
 *   RATE_LIMIT_API_MAX           peticiones a /api por ventana            (600)
 *   RATE_LIMIT_API_WINDOW_MS     ventana global en ms                     (60000 = 1 min)
 *   RATE_LIMIT_DISABLED=true     apaga ambos límites (solo emergencias)
 *
 * Detrás de un proxy (Railway/Render) hay que configurar TRUST_PROXY (ver security.ts); si no,
 * todos los clientes aparecerían con la IP del proxy y compartirían un único cupo.
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response } from 'express';

export interface RateLimitConfig {
  /** Si es true no se monta ningún límite. */
  disabled: boolean;
  /** Intentos de login FALLIDOS permitidos por IP y ventana. */
  loginMax: number;
  loginWindowMs: number;
  /** Peticiones totales a /api permitidas por IP y ventana. */
  apiMax: number;
  apiWindowMs: number;
}

/** Valores por defecto en desarrollo y producción. */
export const RATE_LIMIT_DEFAULTS: Omit<RateLimitConfig, 'disabled'> = {
  loginMax: 10,
  loginWindowMs: 15 * 60 * 1000,
  apiMax: 600,
  apiWindowMs: 60 * 1000,
};

/**
 * Valores por defecto con NODE_ENV=test: tan altos que las pruebas (que hacen decenas de
 * logins desde la misma IP) nunca los alcanzan. Las pruebas de límites inyectan los suyos.
 */
export const RATE_LIMIT_TEST_DEFAULTS: Omit<RateLimitConfig, 'disabled'> = {
  loginMax: 100000,
  loginWindowMs: 15 * 60 * 1000,
  apiMax: 1000000,
  apiWindowMs: 60 * 1000,
};

function readPositiveInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    console.warn(`[Config] ${name}="${raw}" no es un entero positivo; se usa ${fallback}.`);
    return fallback;
  }
  return value;
}

/** Lee la configuración de límites desde el entorno (valores inválidos -> por defecto, con aviso). */
export function readRateLimitConfig(env: NodeJS.ProcessEnv = process.env): RateLimitConfig {
  const defaults = env.NODE_ENV === 'test' ? RATE_LIMIT_TEST_DEFAULTS : RATE_LIMIT_DEFAULTS;
  const disabledRaw = (env.RATE_LIMIT_DISABLED ?? '').trim().toLowerCase();
  return {
    disabled: disabledRaw === 'true' || disabledRaw === '1',
    loginMax: readPositiveInt(env, 'RATE_LIMIT_LOGIN_MAX', defaults.loginMax),
    loginWindowMs: readPositiveInt(env, 'RATE_LIMIT_LOGIN_WINDOW_MS', defaults.loginWindowMs),
    apiMax: readPositiveInt(env, 'RATE_LIMIT_API_MAX', defaults.apiMax),
    apiWindowMs: readPositiveInt(env, 'RATE_LIMIT_API_WINDOW_MS', defaults.apiWindowMs),
  };
}

/** "45 segundos", "1 minuto", "15 minutos": tiempo de espera legible a partir de segundos. */
export function formatWait(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'unos instantes';
  if (seconds < 60) return `${Math.ceil(seconds)} segundos`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}

function retryAfterSeconds(res: Response, fallbackMs: number): number {
  const header = Number(res.getHeader('Retry-After'));
  return Number.isFinite(header) && header > 0 ? header : Math.ceil(fallbackMs / 1000);
}

export interface RateLimiters {
  /** Montar solo en POST /api/auth/login. */
  login: RateLimitRequestHandler;
  /** Montar en /api (no cubre /health). */
  api: RateLimitRequestHandler;
}

/**
 * Crea los dos limitadores con su PROPIO almacén en memoria (cada llamada empieza de cero).
 * Cabeceras estándar RateLimit-Limit/Remaining/Reset (draft-6) + Retry-After al bloquear.
 */
export function createRateLimiters(config: RateLimitConfig): RateLimiters {
  const login = rateLimit({
    windowMs: config.loginWindowMs,
    limit: config.loginMax,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    // Solo cuentan las respuestas >= 400: un inicio de sesión correcto no gasta intentos.
    skipSuccessfulRequests: true,
    handler: (_req: Request, res: Response) => {
      const wait = formatWait(retryAfterSeconds(res, config.loginWindowMs));
      res.status(429).json({
        error: `Demasiados intentos de inicio de sesión fallidos. Espere ${wait} antes de volver a intentarlo.`,
      });
    },
  });

  const api = rateLimit({
    windowMs: config.apiWindowMs,
    limit: config.apiMax,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      const wait = formatWait(retryAfterSeconds(res, config.apiWindowMs));
      res.status(429).json({
        error: `Demasiadas peticiones desde esta red. Espere ${wait} antes de volver a intentarlo.`,
      });
    },
  });

  return { login, api };
}
