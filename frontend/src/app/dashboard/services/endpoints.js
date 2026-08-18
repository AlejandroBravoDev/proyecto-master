/**
 * Centralized API endpoints registry for Dashboard services.
 * Dynamically constructs full URLs combining VITE_API_URL from .env + endpoint path.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const DASHBOARD_ENDPOINTS = {
  KPIS: `${API_BASE_URL}/api/dashboard/kpis`,
};
