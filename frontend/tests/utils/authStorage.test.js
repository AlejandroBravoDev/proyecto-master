import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  clearStoredSession,
  clearStoredToken,
  clearStoredUser,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from '../../src/app/auth/authStorage';

const USER = { id: 1, fullName: 'Administrador', username: 'Admin', role: 'ADMIN', active: true };

afterEach(() => {
  clearStoredToken(); // la copia en memoria es de módulo: que no pase de una prueba a otra
});

describe('authStorage: token', () => {
  it('usa la clave masterfood_auth_token en sessionStorage', () => {
    expect(AUTH_TOKEN_KEY).toBe('masterfood_auth_token');
    expect(AUTH_USER_KEY).toBe('masterfood_auth_user');
  });

  it('sin sesión devuelve null', () => {
    expect(getStoredToken()).toBeNull();
  });

  it('guarda, lee y borra el token', () => {
    setStoredToken('abc.def.ghi');
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBe('abc.def.ghi');
    expect(getStoredToken()).toBe('abc.def.ghi');

    clearStoredToken();
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(getStoredToken()).toBeNull();
  });

  it('un token nuevo reemplaza al anterior', () => {
    setStoredToken('uno');
    setStoredToken('dos');
    expect(getStoredToken()).toBe('dos');
  });

  it('si sessionStorage no deja escribir, el token se conserva en memoria y se puede borrar', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cuota', 'QuotaExceededError');
    });

    expect(() => setStoredToken('en-memoria')).not.toThrow();
    expect(getStoredToken()).toBe('en-memoria');

    clearStoredToken();
    expect(getStoredToken()).toBeNull();
  });

  it('si sessionStorage no deja leer ni borrar, no lanza (sin sesión)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
    expect(() => clearStoredToken()).not.toThrow();
    expect(() => clearStoredUser()).not.toThrow();
    expect(() => clearStoredSession()).not.toThrow();
  });
});

describe('authStorage: usuario', () => {
  it('guarda y lee el usuario como JSON', () => {
    setStoredUser(USER);
    expect(JSON.parse(sessionStorage.getItem(AUTH_USER_KEY))).toEqual(USER);
    expect(getStoredUser()).toEqual(USER);
  });

  it('sin usuario devuelve null', () => {
    expect(getStoredUser()).toBeNull();
  });

  it.each([
    ['JSON corrupto', '{no-es-json'],
    ['un valor que no es un objeto', '42'],
    ['null', 'null'],
  ])('ignora %s', (_name, raw) => {
    sessionStorage.setItem(AUTH_USER_KEY, raw);
    expect(getStoredUser()).toBeNull();
  });

  it('borra el usuario', () => {
    setStoredUser(USER);
    clearStoredUser();
    expect(sessionStorage.getItem(AUTH_USER_KEY)).toBeNull();
  });

  it('si sessionStorage no deja escribir, setStoredUser no lanza', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => setStoredUser(USER)).not.toThrow();
  });
});

describe('authStorage: clearStoredSession', () => {
  it('borra token y usuario a la vez', () => {
    setStoredToken('abc');
    setStoredUser(USER);

    clearStoredSession();

    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
