/**
 * Centralized API endpoints registry for Products and Categories services.
 * Dynamically constructs full URLs combining VITE_API_URL from .env + endpoint path.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const PRODUCT_ENDPOINTS = {
  PRODUCTS: `${API_BASE_URL}/api/products`,
  PRODUCT_DETAIL: (id) => `${API_BASE_URL}/api/products/${id}`,
  CATEGORIES: `${API_BASE_URL}/api/categories`,
  CATEGORY_DETAIL: (id) => `${API_BASE_URL}/api/categories/${id}`,
  INGREDIENTS: `${API_BASE_URL}/api/ingredients`,
};
