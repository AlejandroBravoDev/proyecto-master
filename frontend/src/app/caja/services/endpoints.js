/**
 * Centralized API endpoints registry for Cash Register & Arqueos services.
 * Dynamically constructs full URLs combining VITE_API_URL from .env + endpoint path.
 */

import { getApiBaseUrl } from '../../../config/api';

export const CAJA_ENDPOINTS = {
  get STATUS() { return `${getApiBaseUrl()}/api/caja/status`; },
  get OPEN() { return `${getApiBaseUrl()}/api/caja/open`; },
  get CLOSE() { return `${getApiBaseUrl()}/api/caja/close`; },
  get HISTORY() { return `${getApiBaseUrl()}/api/caja/history`; },
  SESSION_DETAIL: (id) => `${getApiBaseUrl()}/api/caja/session/${id}`,
};

