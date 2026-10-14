import { describe, expect, it, vi } from 'vitest';
import { getApiBaseUrl } from '../../src/config/api';

describe('getApiBaseUrl', () => {
  it('usa VITE_API_URL cuando está definida y le quita las barras finales', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.ejemplo.com///');
    expect(getApiBaseUrl()).toBe('https://api.ejemplo.com');
  });

  it('en producción sin variable usa URLs relativas (cadena vacía)', () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('PROD', true);
    expect(getApiBaseUrl()).toBe('');
  });

  it('en desarrollo sin variable apunta al backend local :3001', () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('PROD', false);
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });

  it('VITE_API_URL es un host: no debe incluir /api (los services lo añaden)', () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3055');
    expect(`${getApiBaseUrl()}/api/products`).toBe('http://localhost:3055/api/products');
  });
});
