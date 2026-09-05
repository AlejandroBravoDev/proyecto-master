/**
 * Dynamic API Base URL resolver.
 * Detects whether the app is running in an Electron production shell (via window.electronAPI)
 * or in a standard browser/Vite dev environment.
 */
export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.electronAPI) {
    if (typeof window.electronAPI.getApiUrl === 'function') {
      const url = window.electronAPI.getApiUrl();
      if (url) return url;
    }
    if (window.electronAPI.apiUrl) {
      return window.electronAPI.apiUrl;
    }
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
};
