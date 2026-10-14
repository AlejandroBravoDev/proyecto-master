import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Pruebas "de estructura": fijan decisiones que, si alguien las rompe sin querer, no fallan en ninguna
// otra prueba (una animación sin definir no da error, un fetch directo funciona igual...).

// Vitest se ejecuta desde frontend/ (npm test); en jsdom `import.meta.url` no es una URL de archivo.
const SRC = join(process.cwd(), 'src');

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const rel = (file) => relative(SRC, file).replace(/\\/g, '/');
const sources = listFiles(SRC)
  .filter((file) => /\.(js|jsx)$/.test(file))
  .map((file) => ({ path: rel(file), code: readFileSync(file, 'utf8') }));
const css = readFileSync(join(SRC, 'index.css'), 'utf8');

const withoutComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const offenders = (predicate) => sources.filter(predicate).map((s) => s.path);

describe('capa HTTP única (I9 + I5)', () => {
  it('solo config/apiFetch.js llama a fetch(): los services pasan por la capa compartida', () => {
    expect(offenders((s) => s.path !== 'config/apiFetch.js' && /\bfetch\s*\(/.test(withoutComments(s.code)))).toEqual([]);
  });

  it('extractErrorMessage existe una sola vez (en config/apiFetch.js)', () => {
    const definitions = offenders((s) => /function\s+extractErrorMessage|const\s+extractErrorMessage/.test(s.code));
    expect(definitions).toEqual(['config/apiFetch.js']);
  });

  it('cada service importa la capa compartida', () => {
    const services = sources.filter((s) => /\/services\/[A-Za-z]+Service\.js$/.test(s.path));
    expect(services.map((s) => s.path).sort()).toEqual([
      'app/auth/services/authService.js',
      'app/caja/services/cajaService.js',
      'app/dashboard/services/dashboardService.js',
      'app/inventory/services/inventoryService.js',
      'app/orders/services/orderService.js',
      'app/products/services/productService.js',
      'app/users/services/userService.js',
    ]);
    services.forEach((s) => expect(s.code, s.path).toMatch(/config\/apiFetch/));
  });

  it('VITE_API_URL solo se lee en config/api.js', () => {
    expect(offenders((s) => s.path !== 'config/api.js' && /import\.meta\.env/.test(s.code))).toEqual([]);
  });
});

describe('formato de moneda único (I4)', () => {
  it('solo common/formatCurrency.js construye un formateador de moneda', () => {
    expect(offenders((s) => /style:\s*['"]currency['"]/.test(s.code))).toEqual(['app/common/formatCurrency.js']);
  });

  it('las utils de cada feature reexportan el formateador en vez de copiarlo', () => {
    const utils = sources.filter((s) => /\/utils\/(cajaUtils|productUtils|orderUtils|inventoryUtils|formatters)\.js$/.test(s.path));
    expect(utils).toHaveLength(5);
    utils.forEach((s) => expect(s.code, s.path).toMatch(/export \{ formatCurrency \} from '\.\.\/\.\.\/common\/formatCurrency'/));
  });
});

describe('feedback con SweetAlert (I6)', () => {
  it('ninguna página tiene un toast local con estado', () => {
    expect(offenders((s) => /const\s+showToast\s*=/.test(s.code))).toEqual([]);
  });

  it('no queda window.confirm / alert / prompt', () => {
    expect(offenders((s) => /\bwindow\.(confirm|alert|prompt)\s*\(/.test(s.code))).toEqual([]);
  });
});

describe('animaciones (I3): las clases animate-* usadas están definidas', () => {
  const BUILT_IN = new Set(['spin', 'pulse', 'ping', 'bounce', 'none']);
  const defined = new Set([...css.matchAll(/--animate-([a-z-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set(
    sources.flatMap((s) => [...s.code.matchAll(/animate-([a-z][a-z-]*)/g)].map((m) => m[1]))
  );

  it('fade-in, slide-up y shake están definidas en @theme con su @keyframes', () => {
    ['fade-in', 'slide-up', 'shake'].forEach((name) => {
      expect(defined, name).toContain(name);
      expect(css, name).toMatch(new RegExp(`@keyframes\\s+${name}\\b`));
    });
  });

  it('toda clase animate-* del código es de Tailwind o está definida en index.css', () => {
    const undefinedClasses = [...used].filter((name) => !BUILT_IN.has(name) && !defined.has(name));
    expect(undefinedClasses).toEqual([]);
  });

  it('las animaciones propias se desactivan con prefers-reduced-motion', () => {
    const block = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/);
    expect(block).not.toBeNull();
    ['animate-fade-in', 'animate-slide-up', 'animate-shake'].forEach((cls) => expect(block[1]).toContain(`.${cls}`));
    expect(block[1]).toMatch(/animation:\s*none/);
  });

  it('las duraciones son sobrias (menos de medio segundo)', () => {
    [...css.matchAll(/--animate-[a-z-]+:\s*[a-z-]+\s+([\d.]+)s/g)].forEach(([, seconds]) => {
      expect(Number(seconds)).toBeLessThan(0.5);
    });
  });
});

describe('código muerto eliminado', () => {
  it('OrderStatusSwitcher ya no está en src (se movió a la papelera por no tener uso)', () => {
    expect(existsSync(join(SRC, 'app/orders/components/OrderStatusSwitcher.jsx'))).toBe(false);
    expect(offenders((s) => /OrderStatusSwitcher/.test(s.code))).toEqual([]);
  });
});
