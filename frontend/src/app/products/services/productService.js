/**
 * Products & Categories Service Layer
 * Handles all HTTP requests for products, categories, recipes and ingredient lookups.
 */

import { requestJson } from '../../../config/apiFetch';
import { PRODUCT_ENDPOINTS } from './endpoints';

/**
 * Fetches products list with optional filters (categoryId, available, productType).
 * @param {{categoryId?: number|string, available?: boolean, productType?: string}} filters
 * @returns {Promise<Array>}
 */
export function fetchProducts(filters = {}) {
  const query = new URLSearchParams();
  if (filters.categoryId) query.append('categoryId', filters.categoryId);
  if (filters.available !== undefined && filters.available !== null && filters.available !== '') {
    query.append('available', String(filters.available));
  }
  if (filters.productType) query.append('productType', filters.productType);

  const url = `${PRODUCT_ENDPOINTS.PRODUCTS}${query.toString() ? `?${query.toString()}` : ''}`;
  return requestJson(url, {}, 'No se pudieron cargar los productos.');
}

/**
 * Fetches detail of a single product including category and full recipe details.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export function fetchProductDetail(id) {
  return requestJson(PRODUCT_ENDPOINTS.PRODUCT_DETAIL(id), {}, 'No se pudo obtener el detalle del producto.');
}

/**
 * Creates a new product with optional nested recipe.
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export function createProduct(data) {
  return requestJson(PRODUCT_ENDPOINTS.PRODUCTS, { method: 'POST', body: data }, 'No se pudo crear el producto.');
}

/**
 * Updates basic product properties or toggles availability.
 * Omitted fields stay unchanged; `description: null` clears the description.
 * @param {number|string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export function updateProduct(id, data) {
  return requestJson(PRODUCT_ENDPOINTS.PRODUCT_DETAIL(id), { method: 'PUT', body: data }, 'No se pudo actualizar el producto.');
}

/**
 * Deletes a product by ID. The backend answers 400 (with a Spanish message) when the product
 * already has order/sale history: in that case it must be deactivated instead of deleted.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export function deleteProduct(id) {
  return requestJson(PRODUCT_ENDPOINTS.PRODUCT_DETAIL(id), { method: 'DELETE' }, 'No se pudo eliminar el producto.');
}

/**
 * Creates or REPLACES the recipe of an already created product (POST /api/recipes is an upsert:
 * the previous ingredient list is replaced by the one sent; an empty list leaves the recipe empty).
 * @param {number|string} productId
 * @param {{ name?: string, ingredients: Array<{ ingredientId: number, quantity: number, measurementUnit: string }> }} recipe
 * @returns {Promise<Object>}
 */
export function saveProductRecipe(productId, recipe) {
  return requestJson(
    PRODUCT_ENDPOINTS.RECIPES,
    {
      method: 'POST',
      body: {
        productId: Number(productId),
        ...(recipe.name ? { name: recipe.name } : {}),
        ingredients: recipe.ingredients,
      },
    },
    'No se pudo guardar la receta del producto.'
  );
}

/**
 * Fetches all menu categories.
 * @returns {Promise<Array>}
 */
export function fetchCategories() {
  return requestJson(PRODUCT_ENDPOINTS.CATEGORIES, {}, 'No se pudieron cargar las categorías.');
}

/**
 * Creates a new category.
 * @param {{name: string, description?: string}} data
 * @returns {Promise<Object>}
 */
export function createCategory(data) {
  return requestJson(PRODUCT_ENDPOINTS.CATEGORIES, { method: 'POST', body: data }, 'No se pudo crear la categoría.');
}

/**
 * Deletes a category by ID. The backend answers 400 (with a Spanish message) when the category
 * still has products: they must be moved or removed first.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export function deleteCategory(id) {
  return requestJson(PRODUCT_ENDPOINTS.CATEGORY_DETAIL(id), { method: 'DELETE' }, 'No se pudo eliminar la categoría.');
}

/**
 * Fetches active warehouse ingredients for recipe configuration with optional search term.
 * @param {string} [searchTerm='']
 * @returns {Promise<Array>}
 */
export function fetchIngredientsForRecipe(searchTerm = '') {
  const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
  return requestJson(`${PRODUCT_ENDPOINTS.INGREDIENTS}${query}`, {}, 'No se pudieron cargar los insumos de bodega.');
}
