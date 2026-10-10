#!/usr/bin/env node
/**
 * Preflight de MasterFood: la comprobación única que se corre antes de dar un cambio por terminado.
 *
 *   1. Backend: `tsc --noEmit`
 *   2. Frontend: `vite build` a una carpeta temporal (no toca frontend/dist)
 *   3. Esquema Prisma vs. SQL de las migraciones (tablas y columnas)  -> el error clásico de este repo
 *   4. Enrutado: toda *.routes.ts está registrada, toda *Page.jsx está en el router
 *   5. Convenciones (avisos): ver la tabla de reglas en SKILL.md
 *   6. Documentación: cada ruta /api y cada modelo aparecen en las referencias de dominio
 *
 * Uso (desde cualquier carpeta):
 *   node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs
 *   node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs --changed        # solo avisos en líneas que modificaste
 *   node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs --skip-build     # sin vite build (más rápido)
 *   node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs --skip-typecheck # sin tsc
 *   --strict    los avisos también hacen fallar (exit 1)
 *   --verbose   muestra todos los hallazgos (por defecto 5 por regla)
 *   --root <dir>  analiza otra copia del repo (carpeta con backend/ y frontend/)
 *
 * Código de salida: 1 si hay errores (o avisos con --strict), 0 en otro caso.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const opt = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'backend')) && fs.existsSync(path.join(dir, 'frontend'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('No se encontró la raíz del repo (carpetas backend/ y frontend/).');
}

const root = path.resolve(opt('--root') || findRepoRoot(here));
const backendDir = path.join(root, 'backend');
const frontendDir = path.join(root, 'frontend');
const changedOnly = has('--changed');
const strict = has('--strict');
const verbose = has('--verbose');

const findings = []; // { rule, level, file, line, message }
const steps = []; // { ok, label, detail }

const toRel = (file) => path.relative(root, file).split(path.sep).join('/');
const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

function addFinding(rule, level, file, line, message) {
  findings.push({ rule, level, file: toRel(file), line, message });
}

// ---------------------------------------------------------------- utilidades de archivos
const SKIP_DIRS = new Set(['node_modules', 'dist', '.vite', 'generated', 'out', 'build']);

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), exts, out);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// Reemplaza comentarios y contenido de strings por espacios (misma longitud) para contar llaves con fiabilidad
function stripNoise(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && d === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += '  ';
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      out += c;
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') {
          out += '  ';
          i += 2;
          continue;
        }
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += c;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// ---------------------------------------------------------------- líneas modificadas (--changed)
function git(args2) {
  const r = spawnSync('git', ['-C', root, ...args2], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout : '';
}

function getChangedMap() {
  const map = new Map();
  let current = null;
  for (const line of git(['diff', '-U0', '--no-color', 'HEAD']).split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim();
      current = p === '/dev/null' ? null : p.replace(/^b\//, '');
      if (current && !map.has(current)) map.set(current, new Set());
      continue;
    }
    const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (m && current) {
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      for (let k = 0; k < count; k++) map.get(current).add(start + k);
    }
  }
  for (const f of git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)) {
    map.set(f, 'ALL');
  }
  return map;
}

const changedMap = changedOnly ? getChangedMap() : null;
const isChanged = (relFile, line) => {
  if (!changedMap) return true;
  const entry = changedMap.get(relFile);
  if (!entry) return false;
  return entry === 'ALL' || entry.has(line);
};

// ---------------------------------------------------------------- 1 y 2: compilación
function runStep(label, fn) {
  const started = Date.now();
  const result = fn();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  steps.push({ ok: result.ok, label, detail: result.detail || `${seconds}s` });
  if (!result.ok && result.output) {
    console.log(`\n--- salida de "${label}" ---\n${result.output.trim().split('\n').slice(0, 40).join('\n')}\n---`);
  }
}

if (!has('--skip-typecheck')) {
  runStep('Backend: tsc --noEmit', () => {
    const tsc = path.join(backendDir, 'node_modules', 'typescript', 'bin', 'tsc');
    if (!fs.existsSync(tsc)) return { ok: false, detail: 'typescript no instalado (npm install en backend/)' };
    const r = spawnSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false'], { cwd: backendDir, encoding: 'utf8' });
    return { ok: r.status === 0, output: `${r.stdout}${r.stderr}` };
  });
}

if (!has('--skip-build')) {
  runStep('Frontend: vite build (carpeta temporal)', () => {
    const vite = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');
    if (!fs.existsSync(vite)) return { ok: false, detail: 'vite no instalado (npm install en frontend/)' };
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-preflight-fe-'));
    try {
      const r = spawnSync(process.execPath, [vite, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], {
        cwd: frontendDir,
        encoding: 'utf8',
      });
      return { ok: r.status === 0, output: `${r.stdout}${r.stderr}` };
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
}

// ---------------------------------------------------------------- 3: deriva esquema <-> migraciones
function checkSchemaDrift() {
  const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
  const schema = read(schemaPath);
  if (!schema) return { ok: true, detail: 'sin schema.prisma' };

  const enumNames = [...schema.matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1]);
  const modelBlocks = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  const modelNames = modelBlocks.map((m) => m[1]);

  // SQL disponible: 001_initial_schema.sql + init.ts (SQL embebido y migraciones incrementales)
  const migrationsDir = path.join(backendDir, 'prisma', 'migrations');
  const sqlFiles = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).map((f) => read(path.join(migrationsDir, f)))
    : [];
  const sql = [...sqlFiles, read(path.join(backendDir, 'src', 'prisma', 'init.ts'))].join('\n');

  const tables = new Map(); // tabla -> Set(columnas)
  for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+"([^"]+)"\s*\(([\s\S]*?)\n\s*\);/g)) {
    const cols = tables.get(m[1]) || new Set();
    for (const line of m[2].split('\n')) {
      const c = line.match(/^\s*"([^"]+)"\s+[A-Za-z]/);
      if (c) cols.add(c[1]);
    }
    tables.set(m[1], cols);
  }
  for (const m of sql.matchAll(/ALTER TABLE\s+"([^"]+)"\s+ADD COLUMN\s+"([^"]+)"/g)) {
    const cols = tables.get(m[1]) || new Set();
    cols.add(m[2]);
    tables.set(m[1], cols);
  }

  let problems = 0;
  for (const [, name, body] of modelBlocks) {
    const table = (body.match(/@@map\("([^"]+)"\)/) || [])[1] || name;
    const sqlCols = tables.get(table);
    const modelLine = lineOf(schema, schema.indexOf(`model ${name} `));

    if (!sqlCols) {
      addFinding('DB-DRIFT', 'error', schemaPath, modelLine, `El modelo ${name} (tabla "${table}") no tiene CREATE TABLE en las migraciones (init.ts / 001_initial_schema.sql). Falta la migración (skill backend-db-migration).`);
      problems++;
      continue;
    }

    for (const rawLine of body.split('\n')) {
      const line = rawLine.replace(/\/\/.*$/, '').trim();
      if (!line || line.startsWith('@@')) continue;
      const f = line.match(/^(\w+)\s+(\w+)(\?|\[\])?(.*)$/);
      if (!f) continue;
      const [, field, type, mod, rest] = f;
      if (mod === '[]') continue; // lista de relación
      if (modelNames.includes(type)) continue; // relación
      if (!enumNames.includes(type) && !['Int', 'BigInt', 'Float', 'Decimal', 'String', 'Boolean', 'DateTime', 'Json', 'Bytes'].includes(type)) continue;
      const column = (rest.match(/@map\("([^"]+)"\)/) || [])[1] || field;
      if (!sqlCols.has(column)) {
        addFinding('DB-DRIFT', 'error', schemaPath, lineOf(schema, schema.indexOf(rawLine)), `La columna "${column}" de ${name} (tabla "${table}") no existe en las migraciones. Falta ALTER TABLE ... ADD COLUMN o CREATE TABLE.`);
        problems++;
      }
    }
  }
  return { ok: problems === 0, detail: problems === 0 ? `${modelNames.length} modelos coinciden con el SQL` : `${problems} diferencia(s)` };
}

// ---------------------------------------------------------------- 4: enrutado
function checkRouting() {
  let problems = 0;

  const routesDir = path.join(backendDir, 'src', 'routes');
  const indexPath = path.join(routesDir, 'index.ts');
  const indexSrc = read(indexPath);
  for (const file of walk(routesDir, ['.routes.ts'])) {
    const base = path.basename(file, '.ts');
    if (!indexSrc.includes(`./${base}`)) {
      addFinding('BE-ROUTE-UNREGISTERED', 'error', file, 1, `${base}.ts no está importado en routes/index.ts: sus endpoints no existen en la API.`);
      problems++;
    }
  }

  const routerPath = path.join(frontendDir, 'src', 'app', 'router.jsx');
  const routerSrc = read(routerPath);
  for (const file of walk(path.join(frontendDir, 'src', 'app'), ['Page.jsx'])) {
    const base = path.basename(file, '.jsx');
    if (!routerSrc.includes(base)) {
      addFinding('FE-ROUTE-MISSING', 'error', file, 1, `${base} no está registrada en app/router.jsx: la pantalla no es alcanzable.`);
      problems++;
    }
  }
  return { ok: problems === 0, detail: problems === 0 ? 'rutas del backend y páginas del frontend registradas' : `${problems} sin registrar` };
}

// ---------------------------------------------------------------- 5: convenciones (por línea)
const cssDefinesAnimation = (() => {
  const css = read(path.join(frontendDir, 'src', 'index.css'));
  return (name) => css.includes(`--animate-${name}`);
})();

const lineRules = [
  {
    id: 'FE-NATIVE-DIALOG',
    area: 'frontend',
    test: (l) => /\b(window\.)?(confirm|alert|prompt)\s*\(/.test(l),
    message: 'Diálogo nativo del navegador: usa confirmDialog / showErrorAlert / showSuccessToast (frontend-alerts-dialogs).',
  },
  {
    id: 'FE-ENV-DIRECT',
    area: 'frontend',
    skip: (f) => f.endsWith('src/config/api.js'),
    test: (l) => /import\.meta\.env\.VITE_API_URL/.test(l),
    message: 'Lee VITE_API_URL directo: usa getApiBaseUrl() de config/api.js (en producción queda "undefined/api/...").',
  },
  {
    id: 'FE-HARDCODED-URL',
    area: 'frontend',
    skip: (f) => f.endsWith('src/config/api.js'),
    test: (l) => /https?:\/\/(?!www\.w3\.org)[^\s'"`)]+/.test(l),
    message: 'URL escrita a mano: constrúyela en services/endpoints.js con getApiBaseUrl().',
  },
  {
    id: 'FE-FETCH-OUTSIDE-SERVICE',
    area: 'frontend',
    skip: (f) => f.includes('/services/') || f.endsWith('src/config/api.js'),
    test: (l) => /\bfetch\s*\(/.test(l),
    message: 'fetch() fuera de services/: las llamadas HTTP van en <feature>Service.js (frontend-api-service).',
  },
  {
    id: 'FE-UNDEFINED-ANIMATION',
    area: 'frontend',
    exts: ['.jsx'],
    test: (l) => {
      const m = l.match(/\banimate-(fade-in|slide-up|shake)\b/);
      return Boolean(m) && !cssDefinesAnimation(m[1]);
    },
    message: 'Clase animate-* sin definir en index.css: no produce ningún efecto (frontend-design-system).',
  },
  {
    id: 'BE-DETAILS-OBJECT',
    area: 'backend',
    test: (l) => /details:\s*(error|err)\s*[,})]/.test(l),
    message: 'Devuelve el objeto de error completo en "details" (filtra internals de Prisma): usa error.message.',
  },
  {
    id: 'BE-REQ-MUTATION',
    area: 'backend',
    test: (l) => /\breq\.(query|params)(\.\w+|\[[^\]]+\])\s*=(?!=)/.test(l),
    message: 'Asignar a req.query/req.params no tiene efecto en Express 5 (getter): usa variables locales.',
  },
  {
    id: 'BE-EACHROW-ASYNC',
    area: 'backend',
    test: (l) => /\.eachRow\(\s*async/.test(l),
    message: 'eachRow(async ...) no espera las promesas (la respuesta sale antes de procesar): recolecta filas y usa for...of (backend-excel-import-export).',
  },
  {
    id: 'BE-BODY-DESTRUCTURE',
    area: 'backend',
    skip: (f) => !f.includes('/controllers/'),
    test: (l) => /=\s*req\.body\s*;/.test(l),
    message: 'En Express 5 req.body puede ser undefined (POST sin JSON -> 500): usa "req.body ?? {}".',
  },
];

function scanLineRules() {
  const counts = {};
  const targets = [
    ...walk(path.join(backendDir, 'src'), ['.ts']).map((f) => ({ f, area: 'backend' })),
    ...walk(path.join(frontendDir, 'src'), ['.js', '.jsx']).map((f) => ({ f, area: 'frontend' })),
  ];

  for (const { f, area } of targets) {
    const rel = toRel(f);
    const lines = read(f).split('\n');
    for (const rule of lineRules) {
      if (rule.area !== area) continue;
      if (rule.exts && !rule.exts.some((e) => f.endsWith(e))) continue;
      if (rule.skip && rule.skip(rel)) continue;
      lines.forEach((text, idx) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(text)) return; // comentarios
        if (rule.test(text) && isChanged(rel, idx + 1)) {
          addFinding(rule.id, 'warn', f, idx + 1, rule.message);
          counts[rule.id] = (counts[rule.id] || 0) + 1;
        }
      });
    }
  }

  // Reglas por archivo ------------------------------------------------------
  for (const { f, area } of targets) {
    const rel = toRel(f);
    const src = read(f);

    // Hooks después de un return condicional en modales (rompe las reglas de hooks)
    if (area === 'frontend' && f.endsWith('.jsx')) {
      const early = src.match(/if\s*\(\s*!is\w+[^)]*\)\s*return\s+null\s*;/);
      if (early) {
        const after = src.slice(early.index + early[0].length);
        const hook = after.match(/\buse(State|Effect|Memo|Callback|Ref|Auth|Context|Navigate|Location)\s*\(/);
        if (hook) {
          const line = lineOf(src, early.index + early[0].length + hook.index);
          if (isChanged(rel, line)) {
            addFinding('FE-HOOK-AFTER-RETURN', 'error', f, line, `Hook (${hook[0].trim()}) después de un "return null" condicional: mueve todos los hooks antes del return (rompe las reglas de hooks).`);
          }
        }
      }
    }

    // prisma.* dentro de prisma.$transaction(async (tx) => ...)
    if (area === 'backend') {
      const stripped = stripNoise(src);
      const re = /\$transaction\s*\(\s*async\s*\(\s*(\w+)[^)]*\)\s*(?::\s*[^=]+)?=>\s*\{/g;
      let m;
      while ((m = re.exec(stripped))) {
        let depth = 1;
        let i = m.index + m[0].length;
        const start = i;
        while (i < stripped.length && depth > 0) {
          if (stripped[i] === '{') depth++;
          else if (stripped[i] === '}') depth--;
          i++;
        }
        const body = stripped.slice(start, i);
        for (const bad of body.matchAll(/\bprisma\./g)) {
          const line = lineOf(stripped, start + bad.index);
          if (isChanged(rel, line)) {
            addFinding('BE-PRISMA-IN-TX', 'error', f, line, `Usa "prisma." dentro de $transaction: debe ser "${m[1]}." (si no, sale de la transacción y puede bloquearse).`);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------- 6: documentación
function checkDocs() {
  const refDir = path.join(root, '.claude', 'skills', 'fullstack-domain-reference', 'references');
  if (!fs.existsSync(refDir)) return;
  const apiDoc = read(path.join(refDir, 'api-endpoints.md'));
  const modelDoc = read(path.join(refDir, 'data-model.md'));

  const indexPath = path.join(backendDir, 'src', 'routes', 'index.ts');
  for (const m of read(indexPath).matchAll(/router\.use\(\s*'(\/[^']+)'/g)) {
    if (!apiDoc.includes(`/api${m[1]}`)) {
      addFinding('DOC-API-MISSING', 'warn', indexPath, 1, `La ruta /api${m[1]} no aparece en fullstack-domain-reference/references/api-endpoints.md.`);
    }
  }

  const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
  for (const m of read(schemaPath).matchAll(/^model\s+(\w+)\s*\{/gm)) {
    if (!modelDoc.includes(`\`${m[1]}\``)) {
      addFinding('DOC-MODEL-MISSING', 'warn', schemaPath, 1, `El modelo ${m[1]} no aparece en fullstack-domain-reference/references/data-model.md.`);
    }
  }
}

// ---------------------------------------------------------------- ejecución
console.log(`Preflight MasterFood  ·  raíz: ${root}${changedOnly ? '  ·  modo --changed' : ''}\n`);

runStep('Esquema Prisma <-> migraciones SQL', checkSchemaDrift);
runStep('Enrutado (backend y frontend)', checkRouting);
scanLineRules();
checkDocs();

// Salida
for (const s of steps) console.log(`${s.ok ? '✓' : '✗'} ${s.label}  (${s.detail})`);

const byRule = new Map();
for (const f of findings) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule).push(f);
}

const errors = findings.filter((f) => f.level === 'error');
const warns = findings.filter((f) => f.level === 'warn');

if (findings.length === 0) {
  console.log('✓ Convenciones y documentación: sin hallazgos');
} else {
  console.log('');
  for (const [rule, list] of byRule) {
    const icon = list[0].level === 'error' ? '✗' : '⚠';
    console.log(`${icon} ${rule} (${list.length}) - ${list[0].message}`);
    const shown = verbose ? list : list.slice(0, 5);
    for (const f of shown) console.log(`     ${f.file}:${f.line}`);
    if (!verbose && list.length > shown.length) console.log(`     ... y ${list.length - shown.length} más (usa --verbose)`);
  }
}

const stepFailures = steps.filter((s) => !s.ok).length;
console.log(`\nResumen: ${stepFailures} paso(s) fallido(s) · ${errors.length} error(es) · ${warns.length} aviso(s)`);

const failed = stepFailures > 0 || errors.length > 0 || (strict && warns.length > 0);
console.log(failed ? 'RESULTADO: ✗ hay que corregir antes de dar por terminado' : 'RESULTADO: ✓ listo (revisa los avisos si los hay)');
process.exit(failed ? 1 : 0);
