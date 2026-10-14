/**
 * S4: CORS y Content-Security-Policy. La configuración se inyecta con `createApp({ env })`,
 * sin tocar process.env.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import {
  buildCspDirectives,
  isLocalOrigin,
  parseAllowedOrigins,
  resolveCorsPolicy,
  resolveTrustProxy,
} from '../../src/middleware/security';
import { useTestApp } from '../helpers/testApp';

useTestApp();

const appWith = (env: NodeJS.ProcessEnv) =>
  supertest(createApp({ env: { NODE_ENV: 'test', ...env }, requestLogger: false }));
const acao = (res: { headers: Record<string, unknown> }) => res.headers['access-control-allow-origin'];

describe('S4: CORS', () => {
  describe('FRONTEND_URL definida: solo esos orígenes', () => {
    const env = { FRONTEND_URL: 'https://pos.example.com/, http://localhost:5173' };

    it('un origen de la lista recibe Access-Control-Allow-Origin (reflejado, nunca *)', async () => {
      const res = await appWith(env).get('/health').set('Origin', 'https://pos.example.com');
      expect(res.status).toBe(200);
      expect(acao(res)).toBe('https://pos.example.com');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['vary']).toMatch(/Origin/i);

      const local = await appWith(env).get('/health').set('Origin', 'http://localhost:5173');
      expect(acao(local)).toBe('http://localhost:5173');
    });

    it('un origen que no está en la lista no recibe cabeceras CORS', async () => {
      for (const origin of [
        'https://evil.example.com',
        'https://pos.example.com.evil.io',
        'http://pos.example.com', // otro esquema
        'http://localhost:5199', // localhost de otro puerto: en lista estricta no se permite
        'null',
      ]) {
        const res = await appWith(env).get('/health').set('Origin', origin);
        expect(res.status).toBe(200); // CORS no bloquea la petición: es el navegador quien oculta la respuesta
        expect(acao(res)).toBeUndefined();
      }
    });

    it('el preflight OPTIONS responde 204 con los métodos solo para orígenes permitidos', async () => {
      const ok = await appWith(env)
        .options('/api/auth/login')
        .set('Origin', 'https://pos.example.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');
      expect(ok.status).toBe(204);
      expect(acao(ok)).toBe('https://pos.example.com');
      expect(ok.headers['access-control-allow-methods']).toMatch(/POST/);

      const denied = await appWith(env)
        .options('/api/auth/login')
        .set('Origin', 'https://evil.example.com')
        .set('Access-Control-Request-Method', 'POST');
      expect(acao(denied)).toBeUndefined();
    });
  });

  describe('producción sin FRONTEND_URL: CORS cerrado (solo mismo origen) y aviso al arrancar', () => {
    it('no concede CORS a ningún origen, ni siquiera localhost, y las peticiones sin Origin funcionan', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        const api = appWith({ NODE_ENV: 'production' });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('FRONTEND_URL'));

        for (const origin of ['https://evil.example.com', 'http://localhost:5173', 'http://127.0.0.1:3001']) {
          const res = await api.get('/health').set('Origin', origin);
          expect(res.status).toBe(200);
          expect(acao(res)).toBeUndefined();
        }
        expect((await api.get('/health')).status).toBe(200); // mismo origen / curl
      } finally {
        warn.mockRestore();
      }
    });

    it('con FRONTEND_URL en producción no avisa y sí concede CORS a esa lista', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        const api = appWith({ NODE_ENV: 'production', FRONTEND_URL: 'https://pos.example.com' });
        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('FRONTEND_URL'));
        expect(acao(await api.get('/health').set('Origin', 'https://pos.example.com'))).toBe('https://pos.example.com');
        expect(acao(await api.get('/health').set('Origin', 'https://evil.example.com'))).toBeUndefined();
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('desarrollo/pruebas sin FRONTEND_URL: solo localhost en cualquier puerto', () => {
    it('permite localhost, 127.0.0.1 y [::1] con cualquier puerto', async () => {
      const api = appWith({});
      for (const origin of ['http://localhost:5173', 'http://localhost:5199', 'http://127.0.0.1:3000', 'http://[::1]:8080', 'http://localhost']) {
        expect(acao(await api.get('/health').set('Origin', origin))).toBe(origin);
      }
    });

    it('rechaza cualquier otro origen (ya no es "true" = todos)', async () => {
      const api = appWith({});
      for (const origin of [
        'https://evil.example.com',
        'http://localhost.evil.com',
        'http://evil.com:5173',
        'http://127.0.0.1.evil.com',
        'http://localhost:5173.evil.com',
        'http://192.168.1.20:5173',
      ]) {
        expect(acao(await api.get('/health').set('Origin', origin))).toBeUndefined();
      }
    });
  });

  describe('funciones puras de configuración', () => {
    it('parseAllowedOrigins normaliza barras finales, rutas, mayúsculas y repetidos', () => {
      expect(parseAllowedOrigins(undefined)).toEqual([]);
      expect(parseAllowedOrigins('')).toEqual([]);
      expect(parseAllowedOrigins(' https://A.example.com/ , https://a.example.com,, http://localhost:5173/app ')).toEqual([
        'https://a.example.com',
        'http://localhost:5173',
      ]);
    });

    it('isLocalOrigin solo acepta loopback con esquema http(s)', () => {
      expect(isLocalOrigin('http://localhost:5173')).toBe(true);
      expect(isLocalOrigin('https://127.0.0.1')).toBe(true);
      expect(isLocalOrigin('http://[::1]:3000')).toBe(true);
      expect(isLocalOrigin('http://localhost.evil.com')).toBe(false);
      expect(isLocalOrigin('ftp://localhost')).toBe(false);
      expect(isLocalOrigin('localhost:5173')).toBe(false);
    });

    it('resolveCorsPolicy: lista > same-origin (producción) > localhost (resto)', () => {
      expect(resolveCorsPolicy({ NODE_ENV: 'production', FRONTEND_URL: 'https://x.com' })).toEqual({ mode: 'list', origins: ['https://x.com'] });
      expect(resolveCorsPolicy({ NODE_ENV: 'production' })).toEqual({ mode: 'same-origin', origins: [] });
      expect(resolveCorsPolicy({ NODE_ENV: 'development' })).toEqual({ mode: 'localhost', origins: [] });
      expect(resolveCorsPolicy({})).toEqual({ mode: 'localhost', origins: [] });
      expect(resolveCorsPolicy({ NODE_ENV: 'production', FRONTEND_URL: ' , ' })).toEqual({ mode: 'same-origin', origins: [] });
    });

    it('resolveTrustProxy: 1 en producción, desactivado en dev/test y configurable', () => {
      expect(resolveTrustProxy({ NODE_ENV: 'production' })).toBe(1);
      expect(resolveTrustProxy({ NODE_ENV: 'development' })).toBe(false);
      expect(resolveTrustProxy({ NODE_ENV: 'test' })).toBe(false);
      expect(resolveTrustProxy({})).toBe(false);
      expect(resolveTrustProxy({ NODE_ENV: 'production', TRUST_PROXY: 'false' })).toBe(false);
      expect(resolveTrustProxy({ NODE_ENV: 'production', TRUST_PROXY: '0' })).toBe(false);
      expect(resolveTrustProxy({ NODE_ENV: 'development', TRUST_PROXY: '2' })).toBe(2);
      expect(resolveTrustProxy({ TRUST_PROXY: 'true' })).toBe(true);
      expect(resolveTrustProxy({ TRUST_PROXY: 'loopback, 10.0.0.0/8' })).toBe('loopback, 10.0.0.0/8');
    });
  });
});

describe('S4: Content-Security-Policy', () => {
  const directive = (csp: string, name: string): string[] => {
    const found = csp
      .split(';')
      .map((part) => part.trim())
      .find((part) => part === name || part.startsWith(`${name} `));
    return found ? found.split(/\s+/).slice(1) : [];
  };

  it('la CSP se envía en todas las respuestas (API y /health)', async () => {
    const api = supertest(createApp());
    for (const url of ['/health', '/api/categories', '/api/no-existe']) {
      const res = await api.get(url);
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy-report-only']).toBeUndefined();
    }
  });

  it('las directivas son compatibles con el frontend compilado y no abren scripts inline ni eval', async () => {
    const res = await supertest(createApp()).get('/health');
    const csp = res.headers['content-security-policy'] as string;

    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
    expect(directive(csp, 'script-src')).toEqual(["'self'"]); // sin 'unsafe-inline' ni 'unsafe-eval'
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'style-src')).toEqual(expect.arrayContaining(["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']));
    expect(directive(csp, 'font-src')).toEqual(expect.arrayContaining(["'self'", 'https://fonts.gstatic.com']));
    expect(directive(csp, 'img-src')).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:', 'https:']));
    expect(directive(csp, 'connect-src')).toEqual(["'self'"]);
    expect(csp).not.toMatch(/unsafe-eval/);
    // Sin upgrade-insecure-requests: el POS puede servirse por HTTP en la red local
    expect(csp).not.toMatch(/upgrade-insecure-requests/);
  });

  it('connect-src incluye los orígenes de FRONTEND_URL', async () => {
    const res = await appWith({ FRONTEND_URL: 'https://pos.example.com/, http://localhost:5173' }).get('/health');
    expect(directive(res.headers['content-security-policy'] as string, 'connect-src')).toEqual([
      "'self'",
      'https://pos.example.com',
      'http://localhost:5173',
    ]);
  });

  it('CSP_REPORT_ONLY=true la envía como Content-Security-Policy-Report-Only (interruptor de emergencia)', async () => {
    const res = await appWith({ CSP_REPORT_ONLY: 'true' }).get('/health');
    expect(res.headers['content-security-policy-report-only']).toMatch(/default-src 'self'/);
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  it('el index.html del SPA servido por el backend lleva la CSP y el resto de cabeceras de helmet', async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-spa-'));
    try {
      fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>spa</title>');
      const api = supertest(createApp({ frontendDist: dist }));

      const index = await api.get('/');
      expect(index.status).toBe(200);
      expect(index.headers['content-security-policy']).toMatch(/script-src 'self'/);
      expect(index.headers['x-content-type-options']).toBe('nosniff');

      // Una ruta del SPA (router de hash o no) cae en index.html; /api desconocido sigue siendo JSON 404
      expect((await api.get('/cualquier/ruta')).status).toBe(200);
      const missing = await api.get('/api/no-existe');
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual({ error: 'Ruta o endpoint no encontrado' });
    } finally {
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });

  it('buildCspDirectives: connect-src es solo self si no hay orígenes', () => {
    expect(buildCspDirectives()['connect-src']).toEqual(["'self'"]);
    expect(buildCspDirectives(['https://a.com'])['connect-src']).toEqual(["'self'", 'https://a.com']);
  });
});
