#!/usr/bin/env node
/**
 * Prueba las migraciones de backend/src/prisma/init.ts SIN tocar tu base de datos real.
 *
 * Qué hace:
 *   1. Crea una BD temporal (vacía, o una copia de --from).
 *   2. Ejecuta initializeDatabase() dos veces (la segunda debe ser un no-op: idempotencia).
 *   3. Compara el esquema entre ambas ejecuciones y corre integrity_check / foreign_key_check.
 *   4. Imprime tablas, migraciones aplicadas y, con --table, las columnas/índices/FKs de esa tabla.
 *
 * Uso (desde la raíz del repo):
 *   node .claude/skills/fullstack-verify-changes/scripts/db-check.mjs
 *   node .claude/skills/fullstack-verify-changes/scripts/db-check.mjs --table suppliers
 *   node .claude/skills/fullstack-verify-changes/scripts/db-check.mjs --from backend/prisma/dev.db
 *   node .claude/skills/fullstack-verify-changes/scripts/db-check.mjs --backend <ruta-a-backend>   (otra copia del backend)
 *   --keep   conserva la carpeta temporal para inspeccionarla
 *
 * Código de salida: 0 = todo bien, 1 = falló alguna comprobación.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

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

// --- argumentos
const args = process.argv.slice(2);
const getOpt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const keep = args.includes('--keep');
const fromDb = getOpt('--from');
const tableName = getOpt('--table');
const backendArg = getOpt('--backend');

const repoRoot = backendArg ? null : findRepoRoot(here);
const backendDir = path.resolve(backendArg || path.join(repoRoot, 'backend'));
const tsNodeBin = path.join(backendDir, 'node_modules', 'ts-node', 'dist', 'bin.js');

if (!fs.existsSync(tsNodeBin)) {
  console.error(`✗ No se encontró ts-node en ${tsNodeBin}. Ejecuta npm install en backend/.`);
  process.exit(1);
}

const requireFromBackend = createRequire(path.join(backendDir, 'package.json'));
const Database = requireFromBackend('better-sqlite3');

// --- BD temporal
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-dbcheck-'));
const dbPath = path.join(tmpDir, 'check.db');
const backupDir = path.join(tmpDir, 'backups');

if (fromDb) {
  const src = path.resolve(fromDb);
  if (!fs.existsSync(src)) {
    console.error(`✗ No existe la BD indicada en --from: ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, dbPath);
  for (const ext of ['-wal', '-shm']) {
    if (fs.existsSync(src + ext)) fs.copyFileSync(src + ext, dbPath + ext);
  }
  console.log(`• Clon de la BD: ${src}  ->  ${dbPath}`);
} else {
  console.log(`• BD vacía temporal: ${dbPath}`);
}

// --- helpers
function runInit(label) {
  const code = "require('./src/prisma/init').initializeDatabase().then(()=>process.exit(0)).catch((e)=>{console.error(e&&e.stack||e);process.exit(1)})";
  const result = spawnSync(process.execPath, [tsNodeBin, '--transpile-only', '-e', code], {
    cwd: backendDir,
    env: { ...process.env, SQLITE_DB_PATH: dbPath, SQLITE_BACKUP_DIR: backupDir, TS_NODE_TRANSPILE_ONLY: 'true' },
    encoding: 'utf8',
  });
  const ok = result.status === 0;
  console.log(`${ok ? '✓' : '✗'} initializeDatabase() ${label}`);
  if (!ok) {
    console.error((result.stderr || result.stdout || '').trim().split('\n').slice(0, 25).join('\n'));
  }
  return ok;
}

function snapshot() {
  const db = new Database(dbPath, { readonly: true });
  try {
    const objects = db
      .prepare("SELECT type, name, tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name")
      .all();
    const tables = objects.filter((o) => o.type === 'table').map((o) => o.name);
    const columns = {};
    for (const t of tables) {
      columns[t] = db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => `${c.name}:${c.type}:${c.notnull}:${c.pk}`);
    }
    const migrations = tables.includes('_migrations')
      ? db.prepare('SELECT id FROM "_migrations" ORDER BY rowid').all().map((r) => r.id)
      : [];
    return { objects: objects.map((o) => `${o.type}:${o.name}`), tables, columns, migrations };
  } finally {
    db.close();
  }
}

// --- ejecución
let failed = false;
const ok1 = runInit('(1.ª ejecución: aplica migraciones)');
if (!ok1) {
  failed = true;
} else {
  const snap1 = snapshot();
  const ok2 = runInit('(2.ª ejecución: debe ser idempotente)');
  if (!ok2) {
    failed = true;
  } else {
    const snap2 = snapshot();
    const same = JSON.stringify(snap1) === JSON.stringify(snap2);
    console.log(`${same ? '✓' : '✗'} el esquema y las migraciones no cambian en la 2.ª ejecución`);
    if (!same) failed = true;

    const db = new Database(dbPath, { readonly: true });
    try {
      const integrity = db.pragma('integrity_check', { simple: true });
      const fkViolations = db.pragma('foreign_key_check');
      console.log(`${integrity === 'ok' ? '✓' : '✗'} integrity_check: ${integrity}`);
      console.log(`${fkViolations.length === 0 ? '✓' : '✗'} foreign_key_check: ${fkViolations.length} violaciones`);
      if (integrity !== 'ok' || fkViolations.length > 0) failed = true;

      console.log(`\nMigraciones aplicadas: ${snap2.migrations.join(', ') || '(ninguna)'}`);
      console.log('Tablas:');
      for (const t of snap2.tables) {
        console.log(`  - ${t} (${snap2.columns[t].length} columnas)`);
      }

      if (tableName) {
        if (!snap2.tables.includes(tableName)) {
          console.log(`\n✗ La tabla "${tableName}" NO existe tras migrar.`);
          failed = true;
        } else {
          console.log(`\nTabla "${tableName}":`);
          for (const c of db.prepare(`PRAGMA table_info("${tableName}")`).all()) {
            console.log(
              `  ${c.pk ? '[PK] ' : '     '}${c.name}  ${c.type}${c.notnull ? ' NOT NULL' : ''}${c.dflt_value !== null ? ` DEFAULT ${c.dflt_value}` : ''}`
            );
          }
          const indexes = db.prepare(`PRAGMA index_list("${tableName}")`).all();
          if (indexes.length) {
            console.log('  Índices:');
            for (const ix of indexes) {
              const cols = db.prepare(`PRAGMA index_info("${ix.name}")`).all().map((c) => c.name).join(', ');
              console.log(`    ${ix.unique ? 'UNIQUE ' : ''}${ix.name} (${cols})`);
            }
          }
          const fks = db.prepare(`PRAGMA foreign_key_list("${tableName}")`).all();
          if (fks.length) {
            console.log('  Claves foráneas:');
            for (const fk of fks) {
              console.log(`    ${fk.from} -> ${fk.table}.${fk.to}  ON DELETE ${fk.on_delete}`);
            }
          }
        }
      }
    } finally {
      db.close();
    }
  }
}

if (keep) {
  console.log(`\n(La carpeta temporal se conserva en ${tmpDir})`);
} else {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(failed ? '\nRESULTADO: ✗ hay problemas en las migraciones' : '\nRESULTADO: ✓ migraciones correctas e idempotentes');
process.exit(failed ? 1 : 0);
