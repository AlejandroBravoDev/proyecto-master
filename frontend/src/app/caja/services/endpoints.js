/**
 * Centralized API endpoints registry for Caja / Sales services.
 * Dynamically constructs full URLs combining VITE_API_URL from .env + endpoint path.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const CAJA_ENDPOINTS = {
  SALES: `${API_BASE_URL}/api/sales`,
  SALE_DETAIL: (id) => `${API_BASE_URL}/api/sales/${id}`,
  PRODUCTS: `${API_BASE_URL}/api/products`,
};
