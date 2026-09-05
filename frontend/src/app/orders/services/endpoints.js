/**
 * Centralized API endpoints registry for Orders services.
 * Dynamically constructs full URLs combining VITE_API_URL from .env + endpoint path.
 */

import { getApiBaseUrl } from '../../../config/api';

export const ORDER_ENDPOINTS = {
  get ORDERS() { return `${getApiBaseUrl()}/api/orders`; },
  ORDER_DETAIL: (id) => `${getApiBaseUrl()}/api/orders/${id}`,
  get PRODUCTS() { return `${getApiBaseUrl()}/api/products`; },
  get CATEGORIES() { return `${getApiBaseUrl()}/api/categories`; },
};

