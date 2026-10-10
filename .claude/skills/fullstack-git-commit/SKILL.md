---
name: fullstack-git-commit
description: Mensajes de commit y flujo de git del repo - Conventional Commits en inglés con los tipos y scopes reales del proyecto (feat(backend/caja), fix(frontend), chore(release)...), un commit por capa y por intención, y revisión previa del diff. Úsala SIEMPRE que pidan un commit, un mensaje de commit, "sube/guarda los cambios", preparar un PR o dividir cambios en commits, aunque solo describan lo que hicieron.
---

# Commits del proyecto

El historial del repo (65 commits) ya sigue Conventional Commits en inglés: 39 `feat`, 10 `chore`, 6 `fix`, 5 `refactor`, 2 `docs`. Mantener ese estilo hace que el historial se pueda leer como changelog y que un cambio dañino se pueda revertir sin arrastrar otros. Los únicos commits fuera de formato son los tres primeros del proyecto ("cambios para producción", "my first commit"...): no los imites.

**Solo crea el commit si el usuario lo pidió**; si pidió "un mensaje", entrégalo en un bloque de código para que lo copie. Si va a ejecutarse `git commit`, usa el pie de coautoría que indique el entorno.

## Formato

```
<type>(<scope>): <summary>

<body opcional: qué y por qué, no cómo>
```

- **Idioma**: inglés, modo imperativo, minúscula tras los dos puntos, sin punto final, asunto de hasta ~72 caracteres (el repo tiene asuntos largos, pero apunta a lo corto).
- **Cuerpo** solo cuando el porqué no es evidente (decisión de diseño, efecto en la BD, ruptura de contrato). Máx. ~72 columnas por línea.
- Rupturas de contrato: pie `BREAKING CHANGE: <qué cambia y qué deben hacer los clientes>`.

## Tipos (los que usa el repo)

| Tipo | Cuándo |
|---|---|
| `feat` | funcionalidad nueva visible para el usuario o para la API |
| `fix` | corrige un comportamiento incorrecto |
| `refactor` | cambia la estructura sin cambiar el comportamiento |
| `chore` | mantenimiento: versiones, dependencias, configuración, scripts (`chore(release): bump project version to 2.0.0`) |
| `docs` | documentación y skills (`docs(skills): ...`) |
| `style` / `perf` / `test` / `build` / `ci` / `revert` | disponibles; casi no se han usado (no hay tests ni CI) |

## Scopes (reales, en uso)

- **Por módulo**: `dashboard`, `inventory`, `auth`, `orders`, `caja`, `products`, `users`, `catalog`.
- **Por capa**: `backend`, `frontend`; combinados con módulo cuando el commit toca solo una capa: `feat(backend/caja)`, `feat(frontend/caja)`, `feat(frontend/router)`.
- **Transversales**: `release`, `security`, `database`, `api`, `ui`, `pos`, `skills`.
- Omite el scope solo si el cambio es realmente transversal.

Ejemplos reales del historial: `feat(inventory): add post /import/ingredients endpoint for bulk excel upload...`, `fix(backend): fix spa catch-all for express 5 and add build scripts`, `fix(security): remove credentials from startup logs and configure cors`, `refactor(frontend): decouple electron forge and configure pure web spa`, `chore(release): bump backend and root version to 2.0.0`.

## Cómo dividir los cambios

Un commit = **una intención** que se pueda revertir sola. Para un módulo nuevo (`fullstack-new-module`), el patrón del repo es un commit por capa, en orden de dependencia:

1. `feat(backend/suppliers): add suppliers model, migration and CRUD endpoints`  (esquema + migración + service/controller/routes juntos: separados dejarían el árbol en un estado que no arranca)
2. `feat(frontend/suppliers): add suppliers page, service and sidebar entry`
3. `docs(skills): document suppliers endpoints and data model`

No mezcles en el mismo commit: refactors sin relación, cambios de formato masivos, ni archivos generados (`dist/`, `*.db`, `node_modules`). Si el diff trae varias intenciones, di cuáles son y propón los comandos para separarlos (`git add -p` es interactivo y no está disponible aquí; añade por archivo con `git add <ruta>`).

## Antes de commitear

1. `git status` y `git diff` (o `--staged`): lee **todo** lo que entra. Nada de `.env`, `.db`, `.db-wal`, `dist/`, `backups/` ni credenciales.
2. `node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs --changed` sin errores.
3. Escribe el mensaje a partir de lo que **hace** el diff, no de lo que recuerdas haber intentado.
4. Pre-commit hooks: si fallan, corrige la causa; no uses `--no-verify`.

## Ramas

La rama de trabajo es `main`. Existen ramas históricas (`backend`, `frontend`, `Linux`, `local-test`) que no se usan en el flujo actual. Si el usuario pide una rama nueva, usa `feature/<nombre-corto>`, `fix/<nombre-corto>` o `chore/<nombre-corto>`; no crees ramas ni hagas push sin que lo pida, y nunca fuerces (`--force`) sobre `main`.

## Qué incluir en un PR (si lo piden)

Título con el mismo formato que el commit principal; cuerpo con: qué cambia y por qué, capas tocadas (BD/backend/frontend), cómo se probó (`preflight`, `api.mjs`, recorrido en navegador, roles probados), migraciones y si requieren copia del `.db`, y avisos conocidos.
