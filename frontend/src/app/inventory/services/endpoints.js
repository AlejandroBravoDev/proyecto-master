/**
 * Centralized API endpoints registry for Inventory services.
 * Dynamically constructs full URLs combining VITE_API_URL from .env + endpoint path.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const INVENTORY_ENDPOINTS = {
  INGREDIENTS: `${API_BASE_URL}/api/ingredients`,
  INGREDIENT_DETAIL: (id) => `${API_BASE_URL}/api/ingredients/${id}`,
  ALERTS: `${API_BASE_URL}/api/inventory/alerts`,
  MOVEMENTS: `${API_BASE_URL}/api/inventory/movements`,
  TEMPLATE: `${API_BASE_URL}/api/ingredients/template/ingredients`,
  EXPORT: `${API_BASE_URL}/api/ingredients/export/ingredients`,
  IMPORT: `${API_BASE_URL}/api/ingredients/import/ingredients`,
};
