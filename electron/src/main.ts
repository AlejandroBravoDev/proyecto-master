import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import http from 'http';

interface DbConfig {
  dbDir: string;
  dbPath: string;
  backupDir: string;
}

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let activePort = 3001;

const isDev = !app.isPackaged;

// 1. Evitar múltiples instancias simultáneas
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * Asegura la estructura de directorios persistentes en %APPDATA%\Sistema Restaurante
 */
function setupDirectories(userDataPath: string): DbConfig {
  const dbDir = path.join(userDataPath, 'database');
  const backupDir = path.join(userDataPath, 'backups');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`[Electron] Directorio de base de datos creado: ${dbDir}`);
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`[Electron] Directorio de backups creado: ${backupDir}`);
  }

  const dbPath = path.join(dbDir, 'database.db');
  return { dbDir, dbPath, backupDir };
}

/**
 * Encuentra un puerto TCP disponible en localhost a partir de startPort
 */
function findFreePort(startPort = 3001, maxAttempts = 50): Promise<number> {
  return new Promise((resolve, reject) => {
    let currentPort = startPort;
    let attempts = 0;

    function testNextPort() {
      if (attempts >= maxAttempts) {
        return reject(new Error(`No se encontró ningún puerto libre tras ${maxAttempts} intentos.`));
      }

      attempts++;
      const server = net.createServer();

      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          currentPort++;
          testNextPort();
        } else {
          reject(err);
        }
      });

      server.once('listening', () => {
        server.close(() => {
          resolve(currentPort);
        });
      });

      server.listen(currentPort, '127.0.0.1');
    }

    testNextPort();
  });
}

/**
 * Espera a que el backend responda exitosamente en el endpoint /health
 */
function waitForBackend(port: number, timeoutMs = 45000): Promise<boolean> {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          return resolve(true);
        }
        retry();
      });

      req.on('error', () => {
        retry();
      });

      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime >= timeoutMs) {
        return resolve(false);
      }
      setTimeout(check, 300);
    };

    check();
  });
}

/**
 * Resuelve rutas según estemos en desarrollo o en la aplicación empaquetada
 */
function resolveAppPaths() {
  const rootDir = path.resolve(__dirname, '../..');

  let backendServerPath = '';
  let frontendIndexPath = '';

  if (isDev) {
    backendServerPath = path.join(rootDir, 'backend', 'dist', 'server.js');
    frontendIndexPath = path.join(rootDir, 'frontend', 'dist', 'index.html');
  } else {
    // En producción empaquetada con electron-builder
    backendServerPath = path.join(process.resourcesPath, 'backend', 'dist', 'server.js');
    frontendIndexPath = path.join(process.resourcesPath, 'frontend', 'dist', 'index.html');

    // Fallback si los recursos se colocan junto a electron dist
    if (!fs.existsSync(backendServerPath)) {
      backendServerPath = path.join(__dirname, '../backend/dist/server.js');
    }
    if (!fs.existsSync(frontendIndexPath)) {
      frontendIndexPath = path.join(__dirname, '../frontend/dist/index.html');
    }
  }

  return { backendServerPath, frontendIndexPath };
}

/**
 * Lanza el backend en segundo plano utilizando el propio runtime de Node de Electron
 */
function startBackendProcess(serverPath: string, port: number, dbConfig: DbConfig): ChildProcess {
  console.log(`[Electron] Iniciando backend Node.js en puerto ${port}...`);

  const env = {
    ...process.env,
    PORT: String(port),
    SQLITE_DB_PATH: dbConfig.dbPath,
    SQLITE_BACKUP_DIR: dbConfig.backupDir,
    DATABASE_URL: `file:${dbConfig.dbPath}`,
    NODE_ENV: isDev ? 'development' : 'production',
    ELECTRON_RUN_AS_NODE: '1', // Permite que el ejecutable de Electron actúe como runtime de Node.js
  };

  const proc = spawn(process.execPath, [serverPath], {
    env,
    cwd: path.dirname(serverPath),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout?.on('data', (data) => {
    console.log(`[Backend stdout]: ${data.toString().trim()}`);
  });

  proc.stderr?.on('data', (data) => {
    console.error(`[Backend stderr]: ${data.toString().trim()}`);
  });

  proc.on('exit', (code, signal) => {
    console.log(`[Backend] Proceso terminado con código ${code}, señal: ${signal}`);
  });

  return proc;
}

/**
 * Detiene el proceso del backend limpiamente y sin dejar huérfanos
 */
function terminateBackend(): void {
  if (backendProcess && !backendProcess.killed) {
    console.log('[Electron] Deteniendo backend...');
    try {
      if (process.platform === 'win32' && backendProcess.pid) {
        spawnSync('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t'], { windowsHide: true });
      } else {
        backendProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error('[Electron] Error cerrando proceso backend:', e);
    }
    backendProcess = null;
  }
}

/**
 * Crea la ventana principal de la aplicación
 */
function createMainWindow(frontendIndexPath: string): void {

  mainWindow = new BrowserWindow({
    title: 'Sistema Restaurante',
    icon: path.join(__dirname, '../masterFoodLogo.ico'),
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (fs.existsSync(frontendIndexPath)) {
    mainWindow.loadFile(frontendIndexPath);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 2. Manejador IPC síncrono para entregar la URL del backend al script preload
ipcMain.on('get-api-config', (event) => {
  event.returnValue = {
    port: activePort,
    url: `http://127.0.0.1:${activePort}`,
  };
});

// 3. Flujo principal al iniciar Electron
app.whenReady().then(async () => {
  try {
    // 1. Configurar directorios de datos y base de datos persistente en %APPDATA%
    const userDataPath = app.getPath('userData');
    console.log(`[Electron] Directorio de datos de usuario: ${userDataPath}`);
    const dbConfig = setupDirectories(userDataPath);

    // 2. Resolver rutas de la app
    const paths = resolveAppPaths();

    // 3. Encontrar puerto libre
    activePort = await findFreePort(3001);
    console.log(`[Electron] Puerto seleccionado para el backend: ${activePort}`);

    // 4. Iniciar proceso hijo backend (el cual inicializa la BD y backup automáticamente)
    backendProcess = startBackendProcess(paths.backendServerPath, activePort, dbConfig);

    // 5. Esperar a que el backend esté listo
    const ready = await waitForBackend(activePort);
    if (!ready) {
      throw new Error('El backend no respondió a la prueba de vida a tiempo.');
    }
    console.log('[Electron] ✅ Backend respondiendo con éxito.');

    // 6. Crear ventana y cargar interfaz de usuario React
    createMainWindow(paths.frontendIndexPath);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow(paths.frontendIndexPath);
      }
    });

  } catch (error: any) {
    console.error('[Electron] Error crítico durante la inicialización:', error);
    try {
      const logFilePath = path.join(app.getPath('userData'), 'startup-error.log');
      const logEntry = `[${new Date().toISOString()}] Error crítico durante la inicialización: ${error?.stack || error?.message || String(error)}\n`;
      fs.appendFileSync(logFilePath, logEntry, 'utf-8');
    } catch (logErr) {
      console.error('[Electron] No se pudo escribir el archivo startup-error.log:', logErr);
    }
    dialog.showErrorBox(
      'Sistema Restaurante - Error de Inicio',
      'No se pudo iniciar el servicio local del restaurante. Por favor verifique que la aplicación no esté bloqueada por un antivirus o reinicie el equipo.\n\nDetalle técnico guardado para soporte.'
    );
    terminateBackend();
    app.quit();
  }
});

// 4. Ciclo de vida y cierre limpio
app.on('before-quit', () => {
  terminateBackend();
});

app.on('will-quit', () => {
  terminateBackend();
});

app.on('window-all-closed', () => {
  terminateBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
