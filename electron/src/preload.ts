import { contextBridge, ipcRenderer } from 'electron';

// Obtener la configuración inicial desde el proceso principal de Electron de forma segura
const apiConfig = ipcRenderer.sendSync('get-api-config') || { port: 3001, url: 'http://localhost:3001' };

contextBridge.exposeInMainWorld('electronAPI', {
  apiUrl: apiConfig.url,
  port: apiConfig.port,
  getApiUrl: () => apiConfig.url,
  platform: process.platform,
});
