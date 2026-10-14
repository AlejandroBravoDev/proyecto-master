# Reporte de pruebas de seguridad — MasterFood POS (entorno local)

**Fecha:** 2026-10-13
**Rama / commit:** `main` @ `1d8f217`
**Entorno probado:** backend local (`npm run dev`, `http://127.0.0.1:3001`), SQLite en `backend/dev.db`
**Autor:** Claude Code (Sonnet 5), a petición del usuario
**Para:** el próximo agente/dev que corrija estos hallazgos

> Antes de tocar cualquiera de estos puntos, lee también `.claude/skills/fullstack-domain-reference/references/known-issues.md`: varios hallazgos de este reporte confirman o se solapan con problemas ya documentados allí (S1-S4, B8, B9). Ese archivo es la referencia "viva"; este reporte es la foto de la sesión de pruebas del 2026-10-13.

## Alcance y método

Se pidieron tres pruebas sobre la instancia local: inyección SQL, límites de tasa (rate limiting) y resistencia a caída por carga. Antes de empezar se respaldó la base de datos de desarrollo en `backups/pre-security-test/` (no hizo falta restaurarla: ninguna prueba modificó datos).

Se probó con peticiones HTTP reales (`curl`) contra el servidor Express ya corriendo, usando las credenciales de prueba locales que dio el usuario (`Admin` / la contraseña sembrada por `initializeDatabase()`, ver S2 en known-issues.md) solo para tener una línea base de "login correcto"; no se imprime la contraseña en este documento ni se repitió en el chat.

**Una de las tres pruebas no se ejecutó**: ver la sección "Prueba de carga / caída total" al final — se explica qué se intentó y por qué se detuvo.

## Resumen ejecutivo

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| T1 | Sin fuerza bruta: el login no tiene límite de intentos | **Alta** | Nuevo, confirmado |
| T2 | Inyección SQL | — | **No explotable** (buena noticia, ver detalle) |
| T3 | Confirmación de S1/S3/B8 ya documentados | Crítica (S1) | Ya conocido, re-confirmado |
| T4 | Prueba de carga/caída total | — | **No ejecutada** (ver nota) |

> La columna "Estado" de la tabla anterior es la de la **foto original** (2026-10-13, antes de las correcciones). El estado actual está en la sección siguiente.

## Estado de remediación (2026-10-13)

Tras este reporte se corrigieron los hallazgos en una remediación coordinada (commits `5bf06d4` a `1ec6130` de `main`). **Todo el resto de este documento, desde "T1 — Sin límite de intentos de login" hasta el final, es el cuerpo histórico**: describe cómo estaba el sistema el 2026-10-13 *antes* de las correcciones (commit `1d8f217`, API sin autenticación ni límites) y se conserva sin cambios como referencia. Los puntos de abajo son los que valen hoy.

| Hallazgo | Estado | Control | Prueba que lo vigila |
|---|---|---|---|
| **T1** — sin límite de intentos de login | **Resuelto** | `express-rate-limit` en el login (10 intentos **fallidos** por IP cada 15 min; un login correcto no consume cupo; cuentan también los 400 y 403) y un límite global de `/api` (600 peticiones por IP por minuto; `/health` queda fuera). Responde 429 en español con `Retry-After` y `RateLimit-*`. Se configura con `RATE_LIMIT_*` y `TRUST_PROXY` (por defecto `1` en producción: detrás de Railway/Render cada cliente tiene su propio cupo en vez de compartir la IP del proxy; hay que definir `NODE_ENV=production`). **Limitación**: el límite es solo por IP, no por usuario (ver `known-issues.md`, S7) | `backend/tests/integration/security-rate-limit.test.ts` (429, cabeceras, el login correcto no consume cupo, `/health` exento, trust proxy) |
| **T2** — inyección SQL | **Sigue "no explotable"** (y mejor que antes) | No hay SQL crudo en las rutas (`grep` de `$queryRaw`/`$executeRaw` en `backend/src`: sin resultados; todo pasa por el query builder de Prisma). Además, un id no numérico en la ruta ahora responde **400** `{ error: 'ID inválido' }` (antes 500) y los 500 ya **no filtran** el objeto de error de Prisma en `details` (siempre texto; los errores de Prisma se sustituyen por uno genérico) | `known-issues.test.ts` (ids inválidos, 500 sin internals) y `unit/http.utils.test.ts` |
| **T3** — S1 / S3 / B8 | **Resueltos** | **S1**: JWT + roles en el servidor: todo `/api` salvo el login exige `Authorization: Bearer <token>`, y cada ruta declara su rol (`ADMIN` / `WORKER`); el usuario se relee de la BD en cada petición. **S3**: helper `errorDetails()` en todos los controllers. **B8**: validación de ids, cuerpos vacíos y JSON inválido. Quedan riesgos menores de sesión y de rol registrados en `known-issues.md` (token en `sessionStorage`, recomendaciones sobre el `WORKER`) | `auth-middleware.test.ts`, `auth-roles.test.ts`, `auth-route-guard.test.ts` (falla si una ruta queda sin token o sin declarar su rol), `known-issues.test.ts`, `security-body.test.ts` |
| **T4** — prueba de carga / caída total | **Pendiente de ejecución** | El procedimiento completo está en [`docs/load-testing.md`](docs/load-testing.md). **Ahora requiere token** (toda la API lo exige): hay que iniciar sesión contra la BD temporal y pasar `Authorization: Bearer ...` a `autocannon`, además de `RATE_LIMIT_DISABLED=true` para no medir el limitador. Cada petición autenticada relee al usuario de la BD, lo que se suma al coste de los endpoints pesados (`GET /api/inventory/movements`, `GET /api/dashboard/kpis`). | — (no hay prueba automática: es una prueba manual con permiso explícito del usuario) |

Otras medidas de la remediación que afectan a este reporte (todas con prueba): CORS cerrado por `FRONTEND_URL` y Content-Security-Policy en modo enforcing (`security-cors-csp.test.ts`), cuerpo máximo de 100 kb (413) y JSON inválido -> 400 (`security-body.test.ts`), contraseña del `Admin` inicial desde `ADMIN_INITIAL_PASSWORD` o aleatoria en producción (`security-admin-password.test.ts`).

**Resultados de T4**: _pendiente de ejecución._ Cuando se ejecute, añade aquí la fecha, el entorno, las ráfagas lanzadas (conexiones y duración), peticiones/s, latencia (media y p99), reparto de códigos HTTP y si el servidor se recuperó (`/health`).

---

**Cuerpo histórico (foto del 2026-10-13 antes de las correcciones): lo que sigue ya no describe el sistema actual salvo T2 y T4.**

## T1 — Sin límite de intentos de login (nuevo hallazgo)

**Qué se probó:** 25 intentos de login consecutivos contra `POST /api/auth/login` con el usuario `Admin` y contraseñas incorrectas.

**Resultado:** las 25 peticiones devolvieron `401` sin ningún `429`, cabecera `Retry-After` ni `X-RateLimit-*`, y sin demora creciente. No hay ningún middleware de rate limiting en el backend (`express-rate-limit`, `slowDown` o similar no están instalados ni importados en `backend/src`).

**Por qué importa:** la contraseña por defecto del `Admin` (`S2` en known-issues.md) es corta y predecible; sin límite de intentos, un ataque de fuerza bruta/diccionario contra `/api/auth/login` es trivial, y no hay bloqueo de cuenta ni backoff. Esto aplica a **todos** los endpoints, no solo login — ninguna ruta tiene límite de tasa.

**Dónde:** `backend/src/server.ts` (cadena de middlewares: helmet, cors, morgan, json — ninguno limita tasa); `backend/src/services/auth.service.ts` (sin bloqueo tras N fallos).

**Cómo actuar (sugerido, a decidir por el equipo):**
- Agregar `express-rate-limit` acotado a `/api/auth/login` (p. ej. 5-10 intentos / 15 min por IP) como mínimo viable.
- Considerar un límite global más laxo en `/api` para mitigar abuso general, con cuidado de no romper el uso normal del POS (un único proceso, un restaurante, pocos usuarios concurrentes).
- Si se implementa, agregar un test en `backend/tests/integration/` (ver skill `backend-testing`) que falle si el límite se quita por error.

**Cómo reproducir:**
```bash
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"Admin\",\"password\":\"wrong-$i\"}"
done
# todas devuelven 401, ninguna 429
```

## T2 — Inyección SQL: no explotable

**Qué se probó:**
- Payloads clásicos (`' OR '1'='1`, `Admin'--`, `' OR 1=1 LIMIT 1--`, etc.) en `username`/`password` de `POST /api/auth/login`.
- Los mismos payloads más `'; DROP TABLE Ingredient; --` y `' UNION SELECT 1,2,3,4,5,6,7--` en el único parámetro de texto libre encontrado en el código, `GET /api/ingredients?search=`.
- Inyección en parámetro de ruta numérico: `GET /api/categories/1' OR '1'='1`.

**Resultado:** en todos los casos el payload se trató como texto literal (login -> `401`; búsquedas -> `200` con `[]`, es decir "no hay insumo que contenga ese texto"). La tabla `categories` se verificó intacta después de los intentos con `DROP TABLE`/`UNION SELECT` (mismas 3 filas que antes de empezar). No se encontró ninguna consulta SQL cruda en el backend: `grep -rn '\$queryRaw|\$executeRaw|queryRawUnsafe|executeRawUnsafe' backend/src` no tuvo coincidencias — todo el acceso a datos pasa por el query builder de Prisma (parametrizado por diseño), incluido `auth.service.ts#login` (`prisma.user.findFirst({ where: { username: { equals: ... } } })`).

**Conclusión:** con el código actual, la inyección SQL clásica no es viable mientras se siga usando exclusivamente el query builder de Prisma. **Riesgo a vigilar:** si en el futuro se agrega algún `$queryRaw`/`$executeRaw` (por ejemplo para un reporte complejo), revisar que use parámetros (`Prisma.sql` / placeholders) y no concatenación de strings — hoy no existe ese riesgo porque no existe ese patrón.

**Efecto secundario observado (no es inyección, corrobora B8/S3 ya documentados):** `GET /api/categories/1' OR '1'='1` devuelve `500` con `{"error":"Error al obtener la categoría","details":{"name":"PrismaClientValidationError","clientVersion":"7.8.0"}}` — Prisma rechaza el id no numérico antes de tocar SQL (por eso no hay inyección), pero el error interno de Prisma se filtra tal cual en la respuesta. Mismo patrón que B8/S3 en `known-issues.md`.

## T3 — Re-confirmación de hallazgos ya conocidos

Durante las pruebas se volvió a comprobar en vivo (no son hallazgos nuevos, ya estaban en `known-issues.md`):
- **S1** — ningún endpoint pidió credenciales ni token; las pruebas de arriba se hicieron sin sesión alguna.
- **S3** — los `500` siguen devolviendo el objeto de error de Prisma en `details` (ver T2).
- **B8** — id no numérico en path param -> `500` en vez de `400` (ver T2).

No se repite aquí el detalle; ver `known-issues.md` para el "cómo actuar" de cada uno.

## T4 — Prueba de carga / intento de caída total: **no ejecutada**

Se pidió explícitamente intentar tumbar el servidor con carga. Se intentó en pasos cada vez más pequeños (un script con ráfagas escalonadas de hasta 2000 peticiones concurrentes; luego solo 30 peticiones concurrentes vía background jobs de shell) y en ambos casos **el permiso para ejecutar el comando fue denegado por el clasificador de "Auto Mode" del entorno** (no por mí ni por el usuario), con el mensaje de que este tipo de acción requiere una regla de permiso explícita para Bash. Las pruebas secuenciales (una petición a la vez, incluido el bloque de fuerza bruta de T1) sí se permitieron sin problema; lo que bloqueó el clasificador fue específicamente generar tráfico **concurrente** contra el servidor, independientemente de la escala.

No se intentó rodear ese bloqueo con otra herramienta (p. ej. el navegador integrado) porque sería el mismo tipo de acción por otra vía, no una alternativa razonable.

**Qué se sabe sin necesidad de tumbarlo:**
- El backend es **un solo proceso Node** (sin cluster, sin PM2), con `better-sqlite3`, que es **síncrono**: cualquier consulta larga bloquea el *event loop* y por lo tanto a todas las demás peticiones mientras dura. Combinado con `GET /api/inventory/movements` (sin paginación, `I2` en known-issues.md) y `GET /api/dashboard/kpis` (agregados), estos son los endpoints con más probabilidad de degradarse primero bajo carga concurrente — buenos candidatos para medir primero si se repite la prueba.
- No hay límite de tamaño de body más allá de los defaults de Express/helmet, ni límite de conexiones concurrentes configurado.

**Cómo completar esta prueba** (para quien la retome, con el entorno en modo no restringido o con permiso explícito del usuario):
```bash
# Ejemplo con una herramienta estándar de carga (no un script custom), contra localhost únicamente:
npx autocannon -c 200 -d 15 http://127.0.0.1:3001/api/dashboard/kpis
npx autocannon -c 200 -d 15 http://127.0.0.1:3001/api/inventory/movements
# Comprobar recuperación después de cada ráfaga:
curl http://127.0.0.1:3001/health
```
Recomendado: correrlo contra una copia de la BD (ver `backups/pre-security-test/`), con el proceso bajo `node --max-old-space-size` conocido para poder leer el motivo si el proceso muere por memoria, y parar si deja de responder — exactamente como se iba a hacer aquí.

## Estado del entorno al terminar

- El backend local sigue corriendo en `http://127.0.0.1:3001` (lo arrancó esta sesión; deténlo con Ctrl+C en su terminal o matando el proceso si quieres liberarlo).
- `backend/dev.db` **no cambió**: el único intento de escritura con payload malicioso (crear una categoría llamada `Test-SQLi'; DROP TABLE Category; --`) fue bloqueado por el mismo clasificador antes de llegar al servidor, así que no quedó dato de prueba que limpiar.
- Respaldo preventivo en `backups/pre-security-test/dev.db(-wal/-shm)`, sin usar.

## Recomendación de prioridad para quien lo arregle

1. **T1 (rate limiting en login)** — la más barata y con mayor relación costo/beneficio inmediata.
2. **S1 (sin autenticación real de servidor)** — ya conocida, es la raíz de la mayoría de los riesgos de seguridad del sistema; sin esto, T1 es una mitigación parcial, no una solución.
3. **S3/B8 (saneo de errores 500 y validación de entrada)** — mejora la postura general y deja de filtrar internals de Prisma.
4. **T4 (carga)** — repetir con permisos explícitos antes de desplegar a producción, especialmente antes de exponer el backend a internet sin autenticación (ver S1).
