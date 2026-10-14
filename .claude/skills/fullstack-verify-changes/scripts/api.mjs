#!/usr/bin/env node
/**
 * Cliente HTTP mínimo para probar la API del backend desde cualquier shell
 * (PowerShell, cmd, bash) sin pelear con comillas ni con el alias `curl` de PowerShell.
 *
 * Uso:
 *   node api.mjs GET /api/suppliers
 *   node api.mjs POST /api/suppliers name=Acme phone=555 active=true
 *   node api.mjs PUT /api/suppliers/1 phone=null                  # null limpia el campo
 *   node api.mjs POST /api/purchases --json "{supplierId:1,items:[{ingredientId:1,quantity:5,unitCost:0.6}]}"
 *   node api.mjs POST /api/orders --file body.json
 *   node api.mjs POST /api/ingredients/import/ingredients --upload file=./plantilla.xlsx
 *   node api.mjs GET /api/ingredients/template/ingredients --out plantilla.xlsx
 *
 * Opciones:
 *   key=valor        campo del body (true/false/null y números se convierten solos; `password` siempre es texto)
 *   key:=<json>      campo con JSON relajado, p. ej. items:=[{productId:1,quantity:2}]
 *   --json "<json>"  body completo (se aceptan claves sin comillas y comillas simples)
 *   --file <ruta>    body desde un archivo JSON
 *   --upload campo=ruta   multipart/form-data con un archivo
 *   --out <ruta>     guarda la respuesta binaria en un archivo
 *   --url <base>     base de la API (por defecto $API_URL o http://localhost:3001)
 *   --header k=v     cabecera extra
 *
 * Sesión (toda la API salvo el login exige `Authorization: Bearer <token>`):
 *   Por defecto el script INICIA SESIÓN solo (POST /api/auth/login) y adjunta el token. El usuario
 *   por defecto es `Admin`; su contraseña de desarrollo (`123456`) solo existe en una BD de prueba
 *   nueva fuera de producción: nunca la uses contra un backend real.
 *   --as <usuario>     (alias --user) inicia sesión con otro usuario, p. ej. un WORKER creado antes
 *   --password <clave> contraseña del usuario ($API_PASSWORD; no se imprime)
 *   --token <jwt>      usa este token y NO inicia sesión ($API_TOKEN)
 *   --no-auth          no inicia sesión ni envía token (para comprobar el 401 sin sesión)
 *   Variables: API_USER, API_PASSWORD, API_TOKEN. A un host que no sea localhost NO se envía la
 *   contraseña por defecto: hay que pasar --password / $API_PASSWORD o --token a propósito.
 *   Los límites de tasa cuentan solo los logins fallidos (10 por IP / 15 min): si fallas varias
 *   veces, espera o arranca el backend de prueba con RATE_LIMIT_DISABLED=true.
 *
 * Código de salida: 0 si la respuesta es 2xx/3xx, 1 en otro caso (útil para encadenar pruebas).
 */

import fs from 'node:fs';
import path from 'node:path';

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

// Credenciales de la BD de prueba nueva (initializeDatabase siembra Admin/123456 fuera de producción)
const DEFAULT_USER = 'Admin';
const DEFAULT_DEV_PASSWORD = '123456';

const isLocalHost = (hostname) => /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(hostname);

function parseLenientJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    // continúa con la versión "relajada"
  }
  const fixed = text
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, s) => JSON.stringify(s.replace(/\\'/g, "'")))
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  try {
    return JSON.parse(fixed);
  } catch (err) {
    throw new Error(`JSON inválido: ${text}\n  (${err.message}). Las cadenas deben ir entre comillas simples o dobles.`);
  }
}

// Git Bash (MSYS) convierte "/api/x" en "C:/Program Files/Git/api/x" al pasar argumentos a programas de Windows.
// Todas las rutas del backend empiezan por /api o /health, así que se puede restaurar sin ambigüedad.
function restoreMsysPath(arg) {
  if (!/^[A-Za-z]:[\\/]/.test(arg)) return null;
  const normalized = arg.replace(/\\/g, '/');
  const match = normalized.match(/\/(api|health)(\/|\?|$)/);
  return match ? normalized.slice(match.index) : null;
}

function coerce(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function parseArgs(argv) {
  const opts = {
    method: 'GET',
    route: null,
    body: undefined,
    headers: {},
    out: null,
    upload: null,
    base: null,
    user: null,
    password: null,
    token: null,
    noAuth: false,
  };
  const fields = {};
  let hasFields = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (METHODS.has(arg.toUpperCase()) && opts.route === null) {
      opts.method = arg.toUpperCase();
    } else if (opts.route === null && (arg.startsWith('/') || arg.startsWith('http'))) {
      opts.route = arg;
    } else if (opts.route === null && restoreMsysPath(arg)) {
      opts.route = restoreMsysPath(arg);
    } else if (arg === '--json') {
      opts.body = parseLenientJson(argv[++i] ?? '');
    } else if (arg === '--file') {
      opts.body = parseLenientJson(fs.readFileSync(argv[++i], 'utf8'));
    } else if (arg === '--upload') {
      const [field, ...rest] = (argv[++i] ?? '').split('=');
      opts.upload = { field, file: rest.join('=') };
    } else if (arg === '--out') {
      opts.out = argv[++i];
    } else if (arg === '--url') {
      opts.base = argv[++i];
    } else if (arg === '--as' || arg === '--user') {
      opts.user = argv[++i];
    } else if (arg === '--password') {
      opts.password = argv[++i];
    } else if (arg === '--token') {
      opts.token = argv[++i];
    } else if (arg === '--no-auth') {
      opts.noAuth = true;
    } else if (arg === '--header') {
      const [k, ...rest] = (argv[++i] ?? '').split('=');
      opts.headers[k] = rest.join('=');
    } else if (arg.includes(':=')) {
      const idx = arg.indexOf(':=');
      fields[arg.slice(0, idx)] = parseLenientJson(arg.slice(idx + 2));
      hasFields = true;
    } else if (arg.includes('=')) {
      const idx = arg.indexOf('=');
      const key = arg.slice(0, idx);
      const raw = arg.slice(idx + 1);
      // `password=123456` debe viajar como texto (el servidor rechaza una contraseña numérica)
      fields[key] = key === 'password' ? raw : coerce(raw);
      hasFields = true;
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }

  if (!opts.route) throw new Error('Falta la ruta (ej. /api/categories).');
  if (hasFields) opts.body = { ...(opts.body ?? {}), ...fields };
  return opts;
}

/** Rutas que no llevan token: el login y el health check. */
function isPublicRoute(url) {
  const { pathname } = new URL(url);
  return pathname === '/api/auth/login' || pathname === '/health';
}

/**
 * Token de sesión para la petición: `--token` / $API_TOKEN, o un login nuevo con el usuario elegido.
 * Devuelve `null` si la petición va sin sesión (`--no-auth`, el propio login o /health).
 * Lanza un Error con el motivo si no se puede iniciar sesión.
 */
async function resolveSession(opts, url) {
  if (opts.noAuth || isPublicRoute(url)) return null;

  const explicitToken = opts.token || process.env.API_TOKEN;
  if (explicitToken) return { token: explicitToken, label: 'token indicado' };

  const target = new URL(url);
  const username = opts.user || process.env.API_USER || DEFAULT_USER;
  const explicitPassword = opts.password || process.env.API_PASSWORD;

  // La contraseña de desarrollo no se manda a un backend que no sea local (podría ser uno real).
  if (!explicitPassword && !isLocalHost(target.hostname)) {
    throw new Error(
      `${target.hostname} no es local: no se envía la contraseña de desarrollo. Indica --password (o $API_PASSWORD) o un --token.`
    );
  }
  const password = explicitPassword || DEFAULT_DEV_PASSWORD;

  let response;
  try {
    response = await fetch(`${target.origin}/api/auth/login`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch (err) {
    throw new Error(`No se pudo conectar para iniciar sesión (${err.cause?.code || err.message}). ¿Está corriendo el backend en ${target.origin}?`);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.token !== 'string') {
    const hint = explicitPassword
      ? ''
      : ' La contraseña de desarrollo solo existe en una BD de prueba nueva fuera de producción: usa --password, --as o --token si la BD es otra.';
    const reason = String(data?.error ?? '').replace(/\.$/, '');
    throw new Error(`No se pudo iniciar sesión como "${username}": ${response.status} ${reason}.${hint}`.replace(/\s+\./, '.'));
  }
  return { token: data.token, label: `${data.user?.username ?? username} (${data.user?.role ?? 'rol desconocido'})` };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const base = (opts.base || process.env.API_URL || 'http://localhost:3001').replace(/\/+$/, '');
  const url = opts.route.startsWith('http') ? opts.route : `${base}${opts.route}`;

  const init = { method: opts.method, headers: { Accept: 'application/json', ...opts.headers } };

  // Sesión: una cabecera Authorization pasada con --header manda sobre el login automático.
  const hasAuthHeader = Object.keys(opts.headers).some((name) => name.toLowerCase() === 'authorization');
  const session = hasAuthHeader ? null : await resolveSession(opts, url);
  if (session) init.headers.Authorization = `Bearer ${session.token}`;

  if (opts.upload) {
    const buffer = fs.readFileSync(opts.upload.file);
    const form = new FormData();
    form.append(opts.upload.field, new Blob([buffer]), path.basename(opts.upload.file));
    init.body = form; // no fijar Content-Type: fetch agrega el boundary
  } else if (opts.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }

  console.log(`${opts.method} ${url}`);
  if (session) console.log(`  sesión: ${session.label}`);
  if (opts.body !== undefined && !opts.upload) {
    // Las contraseñas no se imprimen (p. ej. al probar POST /api/users o PATCH .../password)
    console.log(`  body: ${JSON.stringify(opts.body, (key, value) => (key === 'password' ? '***' : value))}`);
  }

  const started = Date.now();
  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    console.error(`✗ No se pudo conectar (${err.cause?.code || err.message}). ¿Está corriendo el backend en ${base}?`);
    process.exitCode = 1;
    return;
  }
  const ms = Date.now() - started;
  const type = response.headers.get('content-type') || '';
  console.log(`→ ${response.status} ${response.statusText} (${ms} ms) [${type.split(';')[0] || 'sin content-type'}]`);

  if (type.includes('application/json')) {
    const data = await response.json().catch(() => null);
    console.log(JSON.stringify(data, null, 2));
  } else if (type.startsWith('text/') && !type.includes('html')) {
    console.log(await response.text());
  } else {
    const buf = Buffer.from(await response.arrayBuffer());
    if (opts.out) {
      fs.writeFileSync(opts.out, buf);
      console.log(`  ${buf.length} bytes guardados en ${opts.out}`);
    } else {
      console.log(`  contenido binario/HTML de ${buf.length} bytes (usa --out <archivo> para guardarlo)`);
    }
  }

  // process.exitCode (no process.exit): en Windows, salir con conexiones fetch aún cerrándose puede abortar con un assert de libuv
  process.exitCode = response.ok ? 0 : 1;
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
});
