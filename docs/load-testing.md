# Pruebas de carga (T4 de `SECURITY_TEST_REPORT.md`)

Esta guía deja listo el procedimiento para repetir la prueba de carga / intento de caída que quedó **pendiente** en el reporte de seguridad (T4). **Sigue sin ejecutarse** (estado a 2026-10-13): genera tráfico concurrente y hay que lanzarla a propósito, con permiso explícito del usuario, nunca contra producción ni contra tu BD real. Cuando se ejecute, anota los resultados en la sección T4 de `SECURITY_TEST_REPORT.md`.

> **Novedad respecto a la versión anterior de esta guía:** ahora **toda la API exige token** (`Authorization: Bearer <token>`, salvo el login y `/health`). Sin token, cada ráfaga contra `/api/...` mediría solo respuestas `401`, no el servidor. El paso 3 explica cómo obtener un token contra la BD temporal y pasarlo a `autocannon`.

## Reglas de seguridad

1. **Solo contra una BD temporal** y en un **puerto aparte** (aquí `3099`). Nunca contra el backend de producción ni contra `backend/dev.db`.
2. **Desactiva los límites de tasa** con `RATE_LIMIT_DISABLED=true`. El límite global de `/api` (600 peticiones/min por IP por defecto) se agota en un segundo con `autocannon -c 200` y la prueba acabaría midiendo el limitador (todo `429`), no el servidor. El límite del login (10 intentos **fallidos** por IP cada 15 min) también interfiere si pruebas `/api/auth/login` con credenciales malas.
3. Detén la prueba si el servidor deja de responder. Después de cada ráfaga comprueba la recuperación con `/health`.
4. **No pongas contraseñas reales en comandos ni archivos.** Con una BD nueva el usuario es `Admin` con la contraseña de desarrollo (solo existe fuera de producción: no definas `NODE_ENV=production` en esta prueba); con una copia de la BD real, el `Admin` tiene la contraseña **real**: pásala por una variable de entorno de tu terminal y no la repitas en el chat.
5. Una vez terminada, detén el servidor y borra (o mueve a la papelera) la BD temporal.

## 1. Preparar (una vez)

```bash
cd backend
npm run build                      # compila a backend/dist (el servidor se prueba como en producción)
```

Elige la BD de prueba:

- **A. BD nueva (la más simple y segura).** No copies nada: `SQLITE_DB_PATH` apunta a un archivo que aún no existe y `initializeDatabase()` lo crea con migraciones, datos de ejemplo y el usuario `Admin` / contraseña de desarrollo. Sirve para medir el servidor "vacío" (línea base), pero `GET /api/inventory/movements` y los KPI trabajarán con muy pocos datos.
- **B. Copia de una BD con volumen realista.** Lo más seguro es la última copia diaria `backup-YYYY-MM-DD.db` (instantánea consistente creada con `db.backup`, sin archivos `-wal`). Para iniciar sesión necesitas un usuario **ADMIN de esa copia** (ver regla 4).

```powershell
# PowerShell (en backend/) - opción B; ajusta la carpeta de backups si usas SQLITE_BACKUP_DIR
$copia = "$env:TEMP\mf-load.db"
Copy-Item (Get-ChildItem ..\backups\backup-*.db | Sort-Object LastWriteTime | Select-Object -Last 1).FullName $copia
```
```bash
# bash (en backend/) - opción B
cp "$(ls -t ../backups/backup-*.db | head -1)" /tmp/mf-load.db
```

## 2. Arrancar el servidor de prueba (terminal 1)

`--max-old-space-size` fija un tope de memoria conocido: si el proceso muere por falta de memoria, el motivo queda visible en el log. `JWT_SECRET` fijo evita sorpresas si reinicias el servidor a mitad de la prueba (con otro secreto, el token obtenido deja de valer).

```powershell
# PowerShell (en backend/)
$env:SQLITE_DB_PATH = "$env:TEMP\mf-load.db"; $env:SQLITE_BACKUP_DIR = "$env:TEMP\mf-load-backups"
$env:PORT = "3099"; $env:RATE_LIMIT_DISABLED = "true"; $env:JWT_SECRET = "<texto de prueba de 32+ caracteres>"
node --max-old-space-size=512 dist/server.js
```
```bash
# bash (en backend/)
SQLITE_DB_PATH=/tmp/mf-load.db SQLITE_BACKUP_DIR=/tmp/mf-load-backups \
PORT=3099 RATE_LIMIT_DISABLED=true JWT_SECRET="<texto de prueba de 32+ caracteres>" \
node --max-old-space-size=512 dist/server.js
```

Debe aparecer `[Seguridad] RATE_LIMIT_DISABLED=true: los límites de tasa están DESACTIVADOS.` y `POS Backend Server running on http://localhost:3099`. (Con la opción A, el log creará la BD y sembrará el `Admin` de desarrollo; sin `NODE_ENV=production` no imprime ninguna clave.)

## 3. Obtener el token (terminal 2)

Inicia sesión **una vez** contra el servidor de prueba y guarda el token en una variable de la terminal (vale 12 h por defecto, de sobra). Un login correcto no consume el cupo del limitador.

```powershell
# PowerShell - opción A (BD nueva: Admin con la contraseña de desarrollo)
$TOKEN = (Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3099/api/auth/login -ContentType 'application/json' `
  -Body '{"username":"Admin","password":"123456"}').token

# PowerShell - opción B (copia real): la contraseña va en una variable de entorno de ESTA terminal
$TOKEN = (Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3099/api/auth/login -ContentType 'application/json' `
  -Body (@{ username = 'Admin'; password = $env:LOAD_PASSWORD } | ConvertTo-Json)).token
```
```bash
# bash - opción A
TOKEN=$(curl -s -X POST http://127.0.0.1:3099/api/auth/login -H "content-type: application/json" \
  -d '{"username":"Admin","password":"123456"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).token")

# bash - opción B (copia real): export LOAD_PASSWORD=... en esta terminal
TOKEN=$(curl -s -X POST http://127.0.0.1:3099/api/auth/login -H "content-type: application/json" \
  -d "{\"username\":\"Admin\",\"password\":\"$LOAD_PASSWORD\"}" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).token")
```

Comprueba que el token funciona antes de lanzar carga (debe responder `200`, no `401`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3099/api/auth/me
```

## 4. Ráfagas (terminal 2)

Empieza pequeño y sube: `-c` = conexiones concurrentes, `-d` = segundos. `--renderStatusCodes` muestra el reparto de códigos HTTP: **debe ser todo `2xx`**; si ves `401`, el token no llegó (revisa `$TOKEN`) y si ves `429`, olvidaste `RATE_LIMIT_DISABLED=true`. El token se pasa con `-H "Authorization=Bearer $TOKEN"` (autocannon espera `-H clave=valor`, ver `npx autocannon --help`; en PowerShell usa `$TOKEN` igual dentro de las comillas dobles).

```bash
# Línea base (no toca la BD ni necesita token): lo mínimo que aguanta Express
npx autocannon -c 50 -d 10 --renderStatusCodes http://127.0.0.1:3099/health

# Endpoints con más probabilidad de degradarse primero (better-sqlite3 es síncrono: bloquea el event loop)
npx autocannon -c 50  -d 15 --renderStatusCodes -H "Authorization=Bearer $TOKEN" http://127.0.0.1:3099/api/dashboard/kpis
npx autocannon -c 50  -d 15 --renderStatusCodes -H "Authorization=Bearer $TOKEN" http://127.0.0.1:3099/api/inventory/movements
npx autocannon -c 200 -d 15 --renderStatusCodes -H "Authorization=Bearer $TOKEN" http://127.0.0.1:3099/api/dashboard/kpis
npx autocannon -c 200 -d 15 --renderStatusCodes -H "Authorization=Bearer $TOKEN" http://127.0.0.1:3099/api/inventory/movements

# Lo mismo con paginación de servidor, para comparar contra la lista completa
npx autocannon -c 200 -d 15 --renderStatusCodes -H "Authorization=Bearer $TOKEN" "http://127.0.0.1:3099/api/inventory/movements?page=1&limit=50"

# Un endpoint de lectura ligero, con token
npx autocannon -c 50 -d 10 --renderStatusCodes -H "Authorization=Bearer $TOKEN" http://127.0.0.1:3099/api/categories

# Comprobar que el servidor se recupera tras cada ráfaga
curl http://127.0.0.1:3099/health
```

Apunta por ráfaga: peticiones/s, latencia (media y p99), cuántas respuestas no 2xx, errores de conexión/timeouts y la memoria del proceso (`node --max-old-space-size` evita que se coma la máquina). Compara el crecimiento de `/api/inventory/movements` **sin paginar** (lo que hoy pide la pantalla Kardex) con la versión paginada (`?page&limit`, ya disponible en el servidor) frente al volumen de movimientos de la copia. Cada petición autenticada añade una lectura de la tabla de usuarios (el servidor relee al usuario en cada petición), así que la cifra incluye ese coste.

## 5. Comprobar que el limitador aguanta la carga (opcional)

Arranca otro servidor **sin** `RATE_LIMIT_DISABLED` (por defecto: 600 peticiones/min por IP en `/api`, 10 fallos de login/15 min) y lanza una ráfaga corta. **Lo esperado es ver muchos `429`**: es el límite funcionando, no un fallo del servidor; `/health` debe seguir respondiendo `200`. Necesitas un token nuevo de ese servidor (si no defines `JWT_SECRET`, cada arranque genera otro secreto y el token anterior no sirve).

```bash
# con token (el limitador de /api va ANTES de la autenticación: sin token también cuenta y verías 401 y luego 429)
npx autocannon -c 20 -d 5 --renderStatusCodes -H "Authorization=Bearer $TOKEN" http://127.0.0.1:3099/api/categories

# login con contraseña incorrecta: tras 10 fallos, 429 con Retry-After
npx autocannon -c 5 -d 5 --renderStatusCodes -m POST -H "content-type=application/json" \
  -b '{"username":"Admin","password":"incorrecta"}' http://127.0.0.1:3099/api/auth/login
curl http://127.0.0.1:3099/health
```

Tras la prueba del login, ese servidor deja bloqueada la IP 15 minutos (reinícialo para limpiar el contador, que vive en memoria; los logins correctos no cuentan, pero con el cupo agotado ni la contraseña buena entra hasta que venza la ventana).

## 6. Limpieza

Detén el servidor (Ctrl+C), retira `mf-load.db` y `mf-load-backups` de la carpeta temporal y cierra la terminal (o borra la variable `TOKEN` y, si la usaste, `LOAD_PASSWORD`).

## Notas

- Si Claude ejecuta esta prueba, el entorno puede **denegar las ráfagas concurrentes** (así pasó con T4): se necesita permiso explícito del usuario para esa acción.
- El límite global de `/api` es por IP. En el restaurante todas las tablets comparten IP, por eso el valor por defecto es holgado; si la prueba real de carga con tablets simuladas llega a toparse con él, súbelo con `RATE_LIMIT_API_MAX` en lugar de desactivarlo. Detrás del proxy de Railway/Render la IP real viene de `X-Forwarded-For` (`TRUST_PROXY`, por defecto `1` en producción); ver `backend/.env.example`.
- El token es un JWT sin estado: no hace falta cerrar sesión al terminar, y cambiar la contraseña del usuario o desactivarlo lo invalida al instante.
