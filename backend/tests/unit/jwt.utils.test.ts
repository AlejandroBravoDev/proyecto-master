import jwt from 'jsonwebtoken';
import {
  DEFAULT_JWT_EXPIRES_IN,
  TokenError,
  getJwtExpiresIn,
  getJwtSecret,
  passwordVersion,
  resetJwtStateForTests,
  signAccessToken,
  verifyAccessToken,
} from '../../src/utils/jwt.utils';
import { hashPassword } from '../../src/utils/auth.utils';

const SECRET = 'un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres';

describe('jwt.utils', () => {
  const originalSecret = process.env.JWT_SECRET;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    resetJwtStateForTests();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    resetJwtStateForTests();
    warn.mockRestore();
  });

  describe('getJwtSecret', () => {
    it('usa JWT_SECRET si está definida y no avisa cuando tiene 32+ caracteres', () => {
      expect(getJwtSecret({ JWT_SECRET: SECRET })).toBe(SECRET);
      expect(warn).not.toHaveBeenCalled();
    });

    it('con menos de 32 caracteres avisa (una sola vez) pero la usa', () => {
      expect(getJwtSecret({ JWT_SECRET: 'corto' })).toBe('corto');
      expect(getJwtSecret({ JWT_SECRET: 'corto' })).toBe('corto');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(/JWT_SECRET tiene solo 5 caracteres/);
    });

    it.each([[undefined], [''], ['   ']])('JWT_SECRET ausente o vacía (%j): genera un secreto aleatorio estable en el proceso', (value) => {
      const env = { NODE_ENV: 'production', JWT_SECRET: value };
      const first = getJwtSecret(env);
      expect(first).toMatch(/^[0-9a-f]{128}$/); // 64 bytes
      expect(getJwtSecret(env)).toBe(first);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(/JWT_SECRET no está definida.*sesiones se invalidar/s);
    });

    it('el secreto generado cambia entre procesos (aquí, tras reiniciar el estado)', () => {
      const first = getJwtSecret({ NODE_ENV: 'production' });
      resetJwtStateForTests();
      expect(getJwtSecret({ NODE_ENV: 'production' })).not.toBe(first);
    });

    it('en desarrollo también genera uno (con un aviso más suave) y con NODE_ENV=test no avisa', () => {
      getJwtSecret({ NODE_ENV: 'development' });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(/backend\/\.env/);

      resetJwtStateForTests();
      warn.mockClear();
      getJwtSecret({ NODE_ENV: 'test' });
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('getJwtExpiresIn', () => {
    it('por defecto 12h', () => {
      expect(getJwtExpiresIn({})).toBe(DEFAULT_JWT_EXPIRES_IN);
      expect(getJwtExpiresIn({ JWT_EXPIRES_IN: '  ' })).toBe('12h');
    });

    it('acepta textos con unidad y los números como SEGUNDOS', () => {
      expect(getJwtExpiresIn({ JWT_EXPIRES_IN: '30m' })).toBe('30m');
      expect(getJwtExpiresIn({ JWT_EXPIRES_IN: '7d' })).toBe('7d');
      expect(getJwtExpiresIn({ JWT_EXPIRES_IN: '3600' })).toBe(3600);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([['abc'], ['0'], ['-5m'], ['12 horas']])('valor inválido o no positivo (%j): vuelve a 12h con un aviso', (value) => {
      expect(getJwtExpiresIn({ JWT_EXPIRES_IN: value })).toBe('12h');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('JWT_EXPIRES_IN'));
    });
  });

  describe('passwordVersion', () => {
    it('es una huella corta y estable del hash, distinta si el hash cambia', () => {
      const hash = hashPassword('secreto1');
      expect(passwordVersion(hash)).toMatch(/^[0-9a-f]{16}$/);
      expect(passwordVersion(hash)).toBe(passwordVersion(hash));
      // El mismo texto genera otro hash (sal nueva): un cambio de contraseña cambia la huella
      expect(passwordVersion(hashPassword('secreto1'))).not.toBe(passwordVersion(hash));
      expect(passwordVersion(hash)).not.toContain(hash.slice(0, 8));
    });
  });

  describe('signAccessToken / verifyAccessToken', () => {
    const user = { id: 7, role: 'WORKER', passwordHash: hashPassword('secreto1') };

    beforeEach(() => {
      process.env.JWT_SECRET = SECRET;
    });

    it('emite un HS256 con sub, role, pv y exp y se verifica de vuelta', () => {
      const token = signAccessToken(user);
      const decoded = jwt.decode(token, { complete: true }) as jwt.Jwt;
      expect(decoded.header).toMatchObject({ alg: 'HS256', typ: 'JWT' });
      expect(verifyAccessToken(token)).toEqual({ userId: 7, role: 'WORKER', pv: passwordVersion(user.passwordHash) });
    });

    it('la vigencia por defecto es de 12h y se puede sobrescribir', () => {
      const claims = jwt.decode(signAccessToken(user)) as jwt.JwtPayload;
      expect(claims.exp! - claims.iat!).toBe(43200);
      const short = jwt.decode(signAccessToken(user, { expiresIn: 60 })) as jwt.JwtPayload;
      expect(short.exp! - short.iat!).toBe(60);
    });

    it('un token vencido lanza TOKEN_EXPIRED', () => {
      const expired = signAccessToken(user, { expiresIn: -5 });
      expect(() => verifyAccessToken(expired)).toThrow(TokenError);
      try {
        verifyAccessToken(expired);
      } catch (error) {
        expect((error as TokenError).code).toBe('TOKEN_EXPIRED');
      }
    });

    it.each([
      ['texto cualquiera', 'basura'],
      ['firmado con otra clave', jwt.sign({ pv: 'x' }, 'otra-clave', { algorithm: 'HS256', subject: '7', expiresIn: '1h' })],
      ['HS512', jwt.sign({ pv: 'x' }, SECRET, { algorithm: 'HS512', subject: '7', expiresIn: '1h' })],
      ['sin vencimiento', jwt.sign({ pv: 'x' }, SECRET, { algorithm: 'HS256', subject: '7' })],
      ['sin pv', jwt.sign({}, SECRET, { algorithm: 'HS256', subject: '7', expiresIn: '1h' })],
      ['sub no numérico', jwt.sign({ pv: 'x' }, SECRET, { algorithm: 'HS256', subject: 'siete', expiresIn: '1h' })],
      ['sin sub', jwt.sign({ pv: 'x' }, SECRET, { algorithm: 'HS256', expiresIn: '1h' })],
    ])('token inválido (%s) lanza INVALID_TOKEN', (_label, token) => {
      let code: string | undefined;
      try {
        verifyAccessToken(token);
      } catch (error) {
        code = (error as TokenError).code;
      }
      expect(code).toBe('INVALID_TOKEN');
    });

    it('rechaza `alg: none` aunque el contenido sea correcto', () => {
      const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: '7', pv: 'x', exp: Math.floor(Date.now() / 1000) + 600 })}.`;
      expect(() => verifyAccessToken(none)).toThrow(TokenError);
    });

    it('el secreto se lee en cada uso: al cambiarlo, los tokens anteriores dejan de valer', () => {
      const token = signAccessToken(user);
      process.env.JWT_SECRET = `${SECRET}-rotado`;
      expect(() => verifyAccessToken(token)).toThrow(TokenError);
    });
  });
});
