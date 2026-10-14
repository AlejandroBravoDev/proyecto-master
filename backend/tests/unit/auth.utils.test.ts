import { hashPassword, isValidPassword, verifyPassword } from '../../src/utils/auth.utils';

describe('auth.utils', () => {
  describe('isValidPassword', () => {
    it.each([
      ['123456', true],
      ['abcdef', true],
      ['  abcdef  ', true],
      ['12345', false],
      ['     ', false],
      ['', false],
    ])('"%s" -> %s', (password, expected) => {
      expect(isValidPassword(password)).toBe(expected);
    });

    it('rechaza valores que no son texto', () => {
      expect(isValidPassword(undefined as unknown as string)).toBe(false);
      expect(isValidPassword(123456 as unknown as string)).toBe(false);
    });
  });

  describe('hashPassword / verifyPassword', () => {
    it('genera "salt:hash" en hexadecimal', () => {
      expect(hashPassword('secreto1')).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    });

    it('usa sal aleatoria: dos hashes de la misma clave difieren', () => {
      expect(hashPassword('secreto1')).not.toBe(hashPassword('secreto1'));
    });

    it('verifica la contraseña correcta y rechaza la incorrecta', () => {
      const hash = hashPassword('secreto1');
      expect(verifyPassword('secreto1', hash)).toBe(true);
      expect(verifyPassword('secreto2', hash)).toBe(false);
      expect(verifyPassword('Secreto1', hash)).toBe(false);
    });

    it('devuelve false (sin lanzar) ante hashes mal formados', () => {
      expect(verifyPassword('x', '')).toBe(false);
      expect(verifyPassword('x', 'sin-separador')).toBe(false);
      expect(verifyPassword('x', 'a:b:c')).toBe(false);
      expect(verifyPassword('x', undefined as unknown as string)).toBe(false);
    });
  });
});
