/**
 * ====================================================
 * SEGURIDAD HTTP: TRUST PROXY
 * ====================================================
 * Configuración pura (recibe el entorno por parámetro) para poder probarla sin
 * tocar process.env. app.ts la monta al crear la app.
 *
 * Variables de entorno:
 *   TRUST_PROXY       cuántos proxies hay delante (número), `true`/`false` o lista de IPs/subredes.
 *                     Por defecto 1 con NODE_ENV=production (Railway/Render) y desactivado en dev/test.
 */

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
