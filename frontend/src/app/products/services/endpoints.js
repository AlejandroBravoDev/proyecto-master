/**
 * Centralized API endpoints registry for Products and Categories services.
 * Dynamically constructs full URLs combining VITE_API_URL from .env + endpoint path.
 */

import { getApiBaseUrl } from '../../../config/api';

export const PRODUCT_ENDPOINTS = {
  get PRODUCTS() { return `${getApiBaseUrl()}/api/products`; },
  PRODUCT_DETAIL: (id) => `${getApiBaseUrl()}/api/products/${id}`,
  get CATEGORIES() { return `${getApiBaseUrl()}/api/categories`; },
  CATEGORY_DETAIL: (id) => `${getApiBaseUrl()}/api/categories/${id}`,
  get INGREDIENTS() { return `${getApiBaseUrl()}/api/ingredients`; },
};

