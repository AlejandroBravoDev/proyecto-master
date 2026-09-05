/**
 * Centralized API endpoints registry for Inventory services.
 * Dynamically constructs full URLs combining VITE_API_URL from .env + endpoint path.
 */

import { getApiBaseUrl } from '../../../config/api';

export const INVENTORY_ENDPOINTS = {
  get INGREDIENTS() { return `${getApiBaseUrl()}/api/ingredients`; },
  INGREDIENT_DETAIL: (id) => `${getApiBaseUrl()}/api/ingredients/${id}`,
  get ALERTS() { return `${getApiBaseUrl()}/api/inventory/alerts`; },
  get MOVEMENTS() { return `${getApiBaseUrl()}/api/inventory/movements`; },
  get TEMPLATE() { return `${getApiBaseUrl()}/api/ingredients/template/ingredients`; },
  get EXPORT() { return `${getApiBaseUrl()}/api/ingredients/export/ingredients`; },
  get IMPORT() { return `${getApiBaseUrl()}/api/ingredients/import/ingredients`; },
};

