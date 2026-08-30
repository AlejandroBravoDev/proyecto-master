/**
 * Products & Categories Service Layer
 * Handles all HTTP requests for products, categories, recipes and ingredient lookups.
 */

import { PRODUCT_ENDPOINTS } from './endpoints';

/**
 * Fetches products list with optional filters (categoryId, available, productType).
 * @param {{categoryId?: number|string, available?: boolean, productType?: string}} filters
 * @returns {Promise<Array>}
 */
export async function fetchProducts(filters = {}) {
  const query = new URLSearchParams();
  if (filters.categoryId) query.append('categoryId', filters.categoryId);
  if (filters.available !== undefined && filters.available !== null && filters.available !== '') {
    query.append('available', String(filters.available));
  }
  if (filters.productType) query.append('productType', filters.productType);

  const url = `${PRODUCT_ENDPOINTS.PRODUCTS}${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudieron cargar los productos.`);
  }

  return response.json();
}

/**
 * Fetches detail of a single product including category and full recipe details.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function fetchProductDetail(id) {
  const response = await fetch(PRODUCT_ENDPOINTS.PRODUCT_DETAIL(id), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudo obtener el detalle del producto.`);
  }

  return response.json();
}

/**
 * Creates a new product with optional nested recipe.
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function createProduct(data) {
  const response = await fetch(PRODUCT_ENDPOINTS.PRODUCTS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo crear el producto.`);
  }

  return response.json();
}

/**
 * Updates basic product properties or toggles availability.
 * @param {number|string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function updateProduct(id, data) {
  const response = await fetch(PRODUCT_ENDPOINTS.PRODUCT_DETAIL(id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo actualizar el producto.`);
  }

  return response.json();
}

/**
 * Deletes a product by ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function deleteProduct(id) {
  const response = await fetch(PRODUCT_ENDPOINTS.PRODUCT_DETAIL(id), {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo eliminar el producto.`);
  }

  return response.json();
}

/**
 * Fetches all menu categories.
 * @returns {Promise<Array>}
 */
export async function fetchCategories() {
  const response = await fetch(PRODUCT_ENDPOINTS.CATEGORIES, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudieron cargar las categorías.`);
  }

  return response.json();
}

/**
 * Creates a new category.
 * @param {{name: string, description?: string}} data
 * @returns {Promise<Object>}
 */
export async function createCategory(data) {
  const response = await fetch(PRODUCT_ENDPOINTS.CATEGORIES, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo crear la categoría.`);
  }

  return response.json();
}

/**
 * Deletes a category by ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function deleteCategory(id) {
  const response = await fetch(PRODUCT_ENDPOINTS.CATEGORY_DETAIL(id), {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo eliminar la categoría.`);
  }

  return response.json();
}

/**
 * Fetches active warehouse ingredients for recipe configuration.
 * @returns {Promise<Array>}
 */
export async function fetchIngredientsForRecipe() {
  const response = await fetch(PRODUCT_ENDPOINTS.INGREDIENTS, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudieron cargar los insumos de bodega.`);
  }

  return response.json();
}
