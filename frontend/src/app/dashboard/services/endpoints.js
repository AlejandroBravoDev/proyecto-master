/**
 * Centralized API endpoints registry for Dashboard services.
 * Dynamically constructs full URLs combining VITE_API_URL from .env + endpoint path.
 */

import { getApiBaseUrl } from '../../../config/api';

export const DASHBOARD_ENDPOINTS = {
  get KPIS() { return `${getApiBaseUrl()}/api/dashboard/kpis`; },
};
