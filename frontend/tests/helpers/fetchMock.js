import { vi } from 'vitest';

/**
 * Reemplaza `fetch` global por un mock que responde en orden.
 *
 *   const fetchMock = mockFetch(jsonResponse([{ id: 1 }]), jsonResponse({ error: 'x' }, 400));
 *   await fetchProducts();
 *   expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/products', expect.anything());
 *
 * Con una sola respuesta, se reutiliza en todas las llamadas.
 */
export function mockFetch(...responses) {
  const fn = vi.fn();
  responses.forEach((r, i) => {
    if (i === responses.length - 1) fn.mockResolvedValue(r);
    else fn.mockResolvedValueOnce(r);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/**
 * Respuesta tipo fetch con cuerpo JSON.
 * `clone()` devuelve otra respuesta igual: `apiFetch` lee una copia del cuerpo de un 401 para saber el motivo.
 */
export function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    clone: () => jsonResponse(body, status),
  };
}

/** Respuesta cuyo cuerpo no es JSON válido (p. ej. un 502 de un proxy). */
export function brokenJsonResponse(status = 502) {
  return {
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    },
    clone: () => brokenJsonResponse(status),
  };
}

/** Respuesta tipo fetch con un archivo binario (descargas de Excel). */
export function blobResponse(content = 'contenido', status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({}),
    blob: async () => new Blob([content]),
    clone: () => blobResponse(content, status),
  };
}

/**
 * Reemplaza `fetch` por un mock que responde según "MÉTODO /ruta" (sin query ni host).
 * El valor puede ser una respuesta o una función `(url, options) => respuesta`.
 * Una ruta sin simular responde 404 con el nombre de la ruta, para que el fallo sea fácil de ver.
 *
 *   mockFetchRoutes({
 *     'GET /api/products': jsonResponse([]),
 *     'POST /api/orders': (url, options) => jsonResponse({ error: 'Stock insuficiente' }, 400),
 *   });
 */
export function mockFetchRoutes(routes) {
  const fn = vi.fn(async (url, options = {}) => {
    const { pathname } = new URL(url);
    const key = `${String(options.method || 'GET').toUpperCase()} ${pathname}`;
    const handler = routes[key];
    if (handler === undefined) return jsonResponse({ error: `fetch sin simular: ${key}` }, 404);
    return typeof handler === 'function' ? handler(url, options) : handler;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** Devuelve [url, opciones] de la llamada n-ésima (0 = primera) a fetch. */
export function callOf(fetchMock, n = 0) {
  const [url, options] = fetchMock.mock.calls[n];
  return { url, options, body: options?.body ? JSON.parse(options.body) : undefined };
}
