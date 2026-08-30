/**
 * Centralized API endpoints registry for Cash Register & Arqueos services.
 * Dynamically constructs full URLs combining VITE_API_URL from .env + endpoint path.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const CAJA_ENDPOINTS = {
  STATUS: `${API_BASE_URL}/api/caja/status`,
  OPEN: `${API_BASE_URL}/api/caja/open`,
  CLOSE: `${API_BASE_URL}/api/caja/close`,
  HISTORY: `${API_BASE_URL}/api/caja/history`,
  SESSION_DETAIL: (id) => `${API_BASE_URL}/api/caja/session/${id}`,
};
