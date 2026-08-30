/**
 * Centralized API endpoints registry for Orders services.
 * Dynamically constructs full URLs combining VITE_API_URL from .env + endpoint path.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const ORDER_ENDPOINTS = {
  ORDERS: `${API_BASE_URL}/api/orders`,
  ORDER_DETAIL: (id) => `${API_BASE_URL}/api/orders/${id}`,
  PRODUCTS: `${API_BASE_URL}/api/products`,
  CATEGORIES: `${API_BASE_URL}/api/categories`,
};
