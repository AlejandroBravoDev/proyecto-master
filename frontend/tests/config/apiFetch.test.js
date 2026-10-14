import { describe, expect, it, vi } from 'vitest';
import { blobResponse, brokenJsonResponse, callOf, jsonResponse, mockFetch } from '../helpers/fetchMock';
import {
  NETWORK_ERROR_MESSAGE,
  apiFetch,
  extractErrorMessage,
  getAuthHeaders,
  requestBlob,
  requestJson,
} from '../../src/config/apiFetch';

const URL_TEST = 'http://localhost:3055/api/algo';

describe('getAuthHeaders (punto de extensión de la fase S1)', () => {
  it('hoy no añade cabeceras', () => {
    expect(getAuthHeaders()).toEqual({});
  });
});

describe('apiFetch', () => {
  it('delega en fetch con la URL, el método y el cuerpo, y devuelve la Response', async () => {
    const response = jsonResponse({ ok: true });
    const fetchMock = mockFetch(response);

    await expect(apiFetch(URL_TEST, { method: 'POST', body: '{}', headers: { 'X-Test': '1' } })).resolves.toBe(response);

    const { url, options } = callOf(fetchMock);
    expect(url).toBe(URL_TEST);
    expect(options.method).toBe('POST');
    expect(options.body).toBe('{}');
    expect(options.headers).toEqual({ 'X-Test': '1' });
  });

  it('sin opciones envía un objeto de cabeceras (listo para recibir la autenticación)', async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    await apiFetch(URL_TEST);
    expect(callOf(fetchMock).options.headers).toEqual({});
  });

  it('traduce "Failed to fetch" a un mensaje en español', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(apiFetch(URL_TEST)).rejects.toThrow(NETWORK_ERROR_MESSAGE);
    expect(NETWORK_ERROR_MESSAGE).toMatch(/No se pudo conectar con el servidor/);
    expect(NETWORK_ERROR_MESSAGE).not.toMatch(/Failed to fetch/);
  });

  it('una respuesta 4xx/5xx no rechaza: la devuelve para que el llamador la valide', async () => {
    const response = jsonResponse({ error: 'x' }, 500);
    mockFetch(response);
    await expect(apiFetch(URL_TEST)).resolves.toBe(response);
  });
});

describe('extractErrorMessage', () => {
  it.each([
    ['usa error', { error: 'Faltan datos' }, 'Faltan datos'],
    ['usa message si no hay error', { message: 'Algo falló' }, 'Algo falló'],
    ['añade details cuando es texto', { error: 'Error interno', details: 'boom' }, 'Error interno: boom'],
    ['no repite details igual a error', { error: 'Igual', details: 'Igual' }, 'Igual'],
    ['ignora details si es un objeto', { error: 'Error interno', details: { code: 'P2003', meta: {} } }, 'Error interno'],
    ['ignora details si es un arreglo', { error: 'Error interno', details: ['a'] }, 'Error interno'],
    ['ignora details vacío', { error: 'Error interno', details: '  ' }, 'Error interno'],
    ['ignora un error que no es texto', { error: { code: 1 } }, 'FALLBACK'],
    ['usa el fallback si no hay texto', {}, 'FALLBACK'],
    ['usa details solo si hay texto aunque falte error', { details: 'solo detalle' }, 'FALLBACK: solo detalle'],
    ['tolera null', null, 'FALLBACK'],
    ['tolera undefined', undefined, 'FALLBACK'],
    ['tolera un cuerpo que no es objeto', 'texto', 'FALLBACK'],
  ])('%s', (_name, body, expected) => {
    expect(extractErrorMessage(body, 'FALLBACK')).toBe(expected);
  });
});

describe('requestJson', () => {
  it('GET: solo Accept, sin cuerpo ni Content-Type, y devuelve el JSON', async () => {
    const fetchMock = mockFetch(jsonResponse([{ id: 1 }]));
    await expect(requestJson(URL_TEST, {}, 'No se pudo.')).resolves.toEqual([{ id: 1 }]);

    const { options } = callOf(fetchMock);
    expect(options.method).toBe('GET');
    expect(options.headers).toEqual({ Accept: 'application/json' });
    expect(options).not.toHaveProperty('body');
  });

  it('POST con cuerpo JSON: serializa y añade Content-Type', async () => {
    const fetchMock = mockFetch(jsonResponse({ id: 9 }, 201));
    await requestJson(URL_TEST, { method: 'POST', body: { name: 'Flan', price: null } }, 'No se pudo.');

    const { options, body } = callOf(fetchMock);
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' });
    expect(body).toEqual({ name: 'Flan', price: null }); // null viaja (limpia el campo)
  });

  it('un campo undefined se omite del JSON y un null se conserva', async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    await requestJson(URL_TEST, { method: 'PUT', body: { a: undefined, b: null } }, 'No se pudo.');
    expect(fetchMock.mock.calls[0][1].body).toBe('{"b":null}');
  });

  it('FormData: se envía tal cual y SIN Content-Type (lo añade el navegador con el boundary)', async () => {
    const fetchMock = mockFetch(jsonResponse({ message: 'ok' }));
    const form = new FormData();
    form.append('file', new Blob(['x']), 'datos.xlsx');

    await requestJson(URL_TEST, { method: 'POST', body: form }, 'No se pudo.');

    const options = fetchMock.mock.calls[0][1]; // callOf intentaría parsear el FormData como JSON
    expect(options.body).toBe(form);
    expect(options.headers).toEqual({ Accept: 'application/json' });
  });

  it('las cabeceras del llamador se suman a las comunes', async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    await requestJson(URL_TEST, { headers: { 'X-Test': '1' } }, 'No se pudo.');
    expect(callOf(fetchMock).options.headers).toEqual({ Accept: 'application/json', 'X-Test': '1' });
  });

  it('error: muestra el texto en español del backend', async () => {
    mockFetch(jsonResponse({ error: 'Usuario o contraseña incorrectos.' }, 401));
    await expect(requestJson(URL_TEST, {}, 'No se pudo.')).rejects.toThrow('Usuario o contraseña incorrectos.');
  });

  it('error: añade details cuando es texto y lo ignora cuando es un objeto', async () => {
    mockFetch(jsonResponse({ error: 'Error al crear', details: 'columna duplicada' }, 500));
    await expect(requestJson(URL_TEST, {}, 'No se pudo.')).rejects.toThrow('Error al crear: columna duplicada');

    mockFetch(jsonResponse({ error: 'Error al crear', details: { code: 'P2002' } }, 500));
    await expect(requestJson(URL_TEST, {}, 'No se pudo.')).rejects.toThrow(/^Error al crear$/);
  });

  it('error sin texto del backend: mensaje genérico con el código HTTP', async () => {
    mockFetch(jsonResponse({}, 500));
    await expect(requestJson(URL_TEST, {}, 'No se pudo cargar.')).rejects.toThrow('Error (500): No se pudo cargar.');
  });

  it('error con cuerpo que no es JSON (p. ej. un 502 de un proxy): mensaje genérico', async () => {
    mockFetch(brokenJsonResponse(502));
    await expect(requestJson(URL_TEST, {}, 'No se pudo cargar.')).rejects.toThrow('Error (502): No se pudo cargar.');
  });

  it('backend caído: mensaje de conexión en español', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(requestJson(URL_TEST, {}, 'No se pudo cargar.')).rejects.toThrow(NETWORK_ERROR_MESSAGE);
  });
});

describe('requestBlob', () => {
  it('devuelve el Blob y no pide JSON', async () => {
    const fetchMock = mockFetch(blobResponse('xlsx'));
    const blob = await requestBlob(URL_TEST, {}, 'No se pudo descargar.');

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(4);
    expect(callOf(fetchMock).options.method).toBe('GET');
    expect(callOf(fetchMock).options.headers).toEqual({});
  });

  it('error: texto del backend o mensaje genérico con el código', async () => {
    mockFetch(jsonResponse({ error: 'Sin permiso' }, 403));
    await expect(requestBlob(URL_TEST, {}, 'No se pudo descargar.')).rejects.toThrow('Sin permiso');

    mockFetch(brokenJsonResponse(500));
    await expect(requestBlob(URL_TEST, {}, 'No se pudo descargar.')).rejects.toThrow('Error (500): No se pudo descargar.');
  });

  it('backend caído: mensaje de conexión en español', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(requestBlob(URL_TEST)).rejects.toThrow(NETWORK_ERROR_MESSAGE);
  });
});
