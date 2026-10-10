#!/usr/bin/env node
/**
 * Linter de las skills del proyecto (.claude/skills): detecta skills "podridas" cuando el código cambia.
 *
 * Comprueba:
 *   1. Frontmatter: `name` = nombre de la carpeta, `description` presente (<= 1024 caracteres, sin etiquetas < >).
 *   2. Tamaño: SKILL.md <= 500 líneas (aviso desde 400); los detalles largos van en references/.
 *   3. Enlaces entre skills: toda mención `backend-xxx` / `frontend-xxx` / `fullstack-xxx` apunta a una skill que existe.
 *   4. Archivos citados: `references/...`, `scripts/...`, `.claude/skills/...`, `backend/...` y `frontend/...` en código en línea existen
 *      (se ignoran rutas con marcadores `<...>`, `*`, `...` y los módulos de ejemplo Supplier/Purchase de las plantillas).
 *   5. Todo archivo de references/ está enlazado desde su SKILL.md (si no, nadie lo leerá).
 *
 * Uso:  node .claude/skills/fullstack-verify-changes/scripts/check-skills.mjs   [--root <dir>]
 * Código de salida: 1 si hay errores.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const rootArg = args.indexOf('--root') >= 0 ? args[args.indexOf('--root') + 1] : null;

function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.claude', 'skills'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('No se encontró .claude/skills');
}

const root = path.resolve(rootArg || findRepoRoot(here));
const skillsDir = path.join(root, '.claude', 'skills');
const skillNames = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const EXAMPLE_PATH = /(supplier|purchase|Supplier|Purchase|suppliers|purchases)/;

// Archivos que las skills indican CREAR la primera vez que se necesiten (aún no existen en el repo).
// Si algún día se crean, quítalos de esta lista.
const PLANNED_FILES = new Set([
  'backend/src/utils/sequence.utils.ts',
  'frontend/src/app/common/fileUtils.js',
]);
const issues = [];
const report = (level, skill, message) => issues.push({ level, skill, message });

const walkMd = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
};

// Quita bloques de código (```...```) para analizar solo el texto y el código en línea
const stripFences = (text) => text.replace(/```[\s\S]*?```/g, '');

for (const skill of skillNames) {
  const dir = path.join(skillsDir, skill);
  const skillFile = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) {
    report('error', skill, 'falta SKILL.md');
    continue;
  }

  const content = fs.readFileSync(skillFile, 'utf8');

  // 1) frontmatter
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) {
    report('error', skill, 'SKILL.md no empieza con frontmatter YAML (---)');
  } else {
    const name = (fm[1].match(/^name:\s*(.+)$/m) || [])[1]?.trim();
    const description = (fm[1].match(/^description:\s*([\s\S]+?)(?=\n\w+:|$)/m) || [])[1]?.trim();
    if (name !== skill) report('error', skill, `frontmatter name "${name}" no coincide con la carpeta "${skill}"`);
    if (!/^[a-z0-9-]{1,64}$/.test(skill)) report('error', skill, 'el nombre debe ser minúsculas, números y guiones (<= 64)');
    if (!description) report('error', skill, 'falta description');
    else {
      if (description.length > 1024) report('error', skill, `description de ${description.length} caracteres (máx. 1024)`);
      if (/[<>]/.test(description)) report('error', skill, 'description no debe contener < ni >');
      if (description.length < 80) report('warn', skill, 'description muy corta: añade cuándo usarla (frases del usuario)');
    }
  }

  // 2) tamaño
  const lines = content.split('\n').length;
  if (lines > 500) report('error', skill, `SKILL.md tiene ${lines} líneas (máx. 500): mueve detalle a references/`);
  else if (lines > 400) report('warn', skill, `SKILL.md tiene ${lines} líneas (acercándose al límite de 500)`);

  // 3-4) menciones y rutas en cualquier .md de la skill (fuera de bloques de código)
  const mdFiles = walkMd(dir);
  for (const file of mdFiles) {
    const rel = path.relative(skillsDir, file).split(path.sep).join('/');
    const text = stripFences(fs.readFileSync(file, 'utf8'));

    for (const m of text.matchAll(/`((?:backend|frontend|fullstack)-[a-z-]+)`/g)) {
      if (!skillNames.includes(m[1])) report('error', rel, `menciona la skill inexistente "${m[1]}"`);
    }

    for (const m of text.matchAll(/`([^`\n]+)`/g)) {
      const token = m[1].trim();
      if (/[<>*]|\.\.\.|\s|\$|\(|\)/.test(token)) continue;
      if (EXAMPLE_PATH.test(token) || PLANNED_FILES.has(token)) continue;

      let candidate = null;
      if (/^(backend|frontend)\/[\w./-]+\.\w+$/.test(token) || /^(backend|frontend)\/[\w./-]+\/$/.test(token)) candidate = path.join(root, token);
      else if (/^\.claude\/skills\/[\w./-]+$/.test(token)) candidate = path.join(root, token);
      else if (/^(references|scripts)\/[\w.-]+$/.test(token)) candidate = path.join(dir, token);

      if (candidate && !fs.existsSync(candidate)) {
        report('error', rel, `cita el archivo "${token}" que no existe`);
      }
    }
  }

  // 5) references/ huérfanos
  const refDir = path.join(dir, 'references');
  if (fs.existsSync(refDir)) {
    for (const f of fs.readdirSync(refDir)) {
      if (!content.includes(`references/${f}`)) {
        report('warn', skill, `references/${f} no está enlazado desde SKILL.md`);
      }
    }
  }
}

// README del índice: todas las skills listadas
const readme = path.join(skillsDir, 'README.md');
if (fs.existsSync(readme)) {
  const text = fs.readFileSync(readme, 'utf8');
  for (const skill of skillNames) {
    if (!text.includes(`\`${skill}\``)) report('warn', 'README.md', `no lista la skill "${skill}"`);
  }
}

const errors = issues.filter((i) => i.level === 'error');
const warns = issues.filter((i) => i.level === 'warn');
for (const i of issues) console.log(`${i.level === 'error' ? '✗' : '⚠'} [${i.skill}] ${i.message}`);
console.log(`\n${skillNames.length} skills revisadas · ${errors.length} error(es) · ${warns.length} aviso(s)`);
process.exit(errors.length > 0 ? 1 : 0);
