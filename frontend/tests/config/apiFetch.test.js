import { afterEach, describe, expect, it, vi } from 'vitest';
import { blobResponse, brokenJsonResponse, callOf, jsonResponse, mockFetch } from '../helpers/fetchMock';
import {
  NETWORK_ERROR_MESSAGE,
  apiFetch,
  extractErrorMessage,
  getAuthHeaders,
  requestBlob,
  requestJson,
  setUnauthorizedHandler,
} from '../../src/config/apiFetch';
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from '../../src/app/auth/authStorage';

const URL_TEST = 'http://localhost:3055/api/algo';
const URL_LOGIN = 'http://localhost:3055/api/auth/login';
const USER = { id: 1, username: 'Admin', role: 'ADMIN', active: true };

/** Deja una sesión guardada (token + usuario), como tras un login correcto. */
function startSession(token = 'abc.def.ghi') {
  setStoredToken(token);
  setStoredUser(USER);
}

afterEach(() => {
  setUnauthorizedHandler(null); // el handler es de módulo: que no pase de una prueba a otra
});

describe('getAuthHeaders', () => {
  it('sin sesión no añade cabeceras', () => {
    expect(getAuthHeaders()).toEqual({});
  });

  it('con token guardado devuelve Authorization: Bearer <token>', () => {
    setStoredToken('abc.def.ghi');
    expect(getAuthHeaders()).toEqual({ Authorization: 'Bearer abc.def.ghi' });
  });

  it('acepta el token como argumento (y null = petición pública)', () => {
    setStoredToken('guardado');
    expect(getAuthHeaders('otro')).toEqual({ Authorization: 'Bearer otro' });
    expect(getAuthHeaders(null)).toEqual({});
  });
});

describe('apiFetch: token de la sesión', () => {
  it('con sesión, añade Authorization: Bearer <token> a la petición', async () => {
    startSession('abc.def.ghi');
    const fetchMock = mockFetch(jsonResponse({}));
    await apiFetch(URL_TEST, { method: 'POST', body: '{}', headers: { 'X-Test': '1' } });
    expect(callOf(fetchMock).options.headers).toEqual({ 'X-Test': '1', Authorization: 'Bearer abc.def.ghi' });
  });

  it('sin sesión no manda Authorization', async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    await apiFetch(URL_TEST);
    expect(callOf(fetchMock).options.headers).not.toHaveProperty('Authorization');
  });

  it('las cabeceras del llamador tienen prioridad sobre el token', async () => {
    startSession('abc.def.ghi');
    const fetchMock = mockFetch(jsonResponse({}));
    await apiFetch(URL_TEST, { headers: { Authorization: 'Bearer del-llamador' } });
    expect(callOf(fetchMock).options.headers.Authorization).toBe('Bearer del-llamador');
  });

  it('skipAuth (el login): no manda el token y la opción no llega a fetch', async () => {
    startSession('abc.def.ghi');
    const fetchMock = mockFetch(jsonResponse({}));
    await apiFetch(URL_LOGIN, { method: 'POST', body: '{}', skipAuth: true });

    const { options } = callOf(fetchMock);
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(options).not.toHaveProperty('skipAuth');
  });

  it('requestJson y requestBlob mandan el token; requestJson con skipAuth no', async () => {
    startSession('abc.def.ghi');
    const fetchMock = mockFetch(blobResponse('xlsx'));

    await requestJson(URL_TEST, {}, 'No se pudo.');
    await requestBlob(URL_TEST, {}, 'No se pudo.');
    await requestJson(URL_LOGIN, { method: 'POST', body: { a: 1 }, skipAuth: true }, 'No se pudo.');

    expect(callOf(fetchMock, 0).options.headers.Authorization).toBe('Bearer abc.def.ghi');
    expect(callOf(fetchMock, 1).options.headers.Authorization).toBe('Bearer abc.def.ghi');
    expect(callOf(fetchMock, 2).options.headers).not.toHaveProperty('Authorization');
  });
});

describe('apiFetch: 401 (sesión caída)', () => {
  const tokenExpired = () =>
    jsonResponse({ error: 'Tu sesión expiró. Inicia sesión de nuevo.', code: 'TOKEN_EXPIRED' }, 401);

  it('limpia token y usuario, llama al handler UNA vez con el motivo y devuelve la respuesta', async () => {
    startSession();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const response = tokenExpired();
    mockFetch(response);

    await expect(apiFetch(URL_TEST)).resolves.toBe(response);

    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_USER_KEY)).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ code: 'TOKEN_EXPIRED', message: 'Tu sesión expiró. Inicia sesión de nuevo.' });
  });

  it('el handler ya ve la sesión borrada y se llama antes de que apiFetch devuelva', async () => {
    startSession();
    const seen = [];
    setUnauthorizedHandler(() => seen.push(getStoredToken()));
    mockFetch(tokenExpired());

    await apiFetch(URL_TEST);
    expect(seen).toEqual([null]);
  });

  it('varias peticiones paralelas con 401 cierran la sesión una sola vez', async () => {
    startSession();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const fetchMock = mockFetch(tokenExpired());

    const responses = await Promise.all([apiFetch(URL_TEST), apiFetch(URL_TEST), apiFetch(URL_TEST)]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    responses.forEach((r) => expect(r.status).toBe(401));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('el 401 no consume el cuerpo: el service sigue mostrando el texto del servidor', async () => {
    startSession();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(jsonResponse({ error: 'Sesión vencida', code: 'INVALID_TOKEN' }, 401));

    await expect(requestJson(URL_TEST, {}, 'No se pudo.')).rejects.toThrow('Sesión vencida');
    expect(handler).toHaveBeenCalledWith({ code: 'INVALID_TOKEN', message: 'Sesión vencida' });
  });

  it('un 401 sin cuerpo JSON también cierra la sesión (motivo desconocido)', async () => {
    startSession();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(brokenJsonResponse(401));

    await apiFetch(URL_TEST);
    expect(getStoredToken()).toBeNull();
    expect(handler).toHaveBeenCalledWith({ code: null, message: null });
  });

  it('sin handler registrado igualmente limpia la sesión', async () => {
    startSession();
    mockFetch(tokenExpired());
    await apiFetch(URL_TEST);
    expect(getStoredToken()).toBeNull();
  });

  it('si el handler lanza un error, la petición devuelve igual la respuesta', async () => {
    startSession();
    setUnauthorizedHandler(() => {
      throw new Error('boom');
    });
    const response = tokenExpired();
    mockFetch(response);

    await expect(apiFetch(URL_TEST)).resolves.toBe(response);
    expect(getStoredToken()).toBeNull();
  });

  it('un 401 tardío de una sesión anterior no cierra la sesión nueva', async () => {
    startSession('token-viejo');
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    let release;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((resolve) => (release = resolve))));

    const pending = apiFetch(URL_TEST); // sale con token-viejo
    startSession('token-nuevo'); // mientras tanto el usuario vuelve a entrar
    release(tokenExpired());
    await pending;

    expect(handler).not.toHaveBeenCalled();
    expect(getStoredToken()).toBe('token-nuevo');
  });

  it('un 401 de una petición SIN token (no había sesión) no dispara el handler', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(jsonResponse({ error: 'Falta el token', code: 'NO_TOKEN' }, 401));

    await apiFetch(URL_TEST);
    expect(handler).not.toHaveBeenCalled();
  });

  it('el 401 del login (credenciales incorrectas) no cierra la sesión ni dispara el handler', async () => {
    startSession();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(jsonResponse({ error: 'Usuario o contraseña incorrectos.' }, 401));

    await expect(
      requestJson(URL_LOGIN, { method: 'POST', body: { username: 'x', password: 'y' }, skipAuth: true }, 'Credenciales inválidas.')
    ).rejects.toThrow('Usuario o contraseña incorrectos.');

    expect(handler).not.toHaveBeenCalled();
    expect(getStoredToken()).toBe('abc.def.ghi');
  });

  it('un 403 (rol insuficiente) no cierra la sesión y muestra el texto del servidor', async () => {
    startSession();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(jsonResponse({ error: 'No tienes permisos para realizar esta acción.' }, 403));

    await expect(requestJson(URL_TEST, {}, 'No se pudo.')).rejects.toThrow('No tienes permisos para realizar esta acción.');

    expect(handler).not.toHaveBeenCalled();
    expect(getStoredToken()).toBe('abc.def.ghi');
    expect(getStoredUser()).toEqual(USER);
  });

  it('un error de red no cierra la sesión', async () => {
    startSession();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(apiFetch(URL_TEST)).rejects.toThrow(NETWORK_ERROR_MESSAGE);
    expect(handler).not.toHaveBeenCalled();
    expect(getStoredToken()).toBe('abc.def.ghi');
  });

  it('setUnauthorizedHandler devuelve una función que lo quita, sin quitar uno más nuevo', async () => {
    startSession();
    const first = vi.fn();
    const second = vi.fn();
    const removeFirst = setUnauthorizedHandler(first);
    setUnauthorizedHandler(second);
    removeFirst(); // el primero ya no es el registrado: no debe quitar al segundo

    mockFetch(tokenExpired());
    await apiFetch(URL_TEST);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
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

  it('sin opciones ni sesión envía un objeto de cabeceras vacío', async () => {
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
