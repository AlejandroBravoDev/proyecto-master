import { Prisma } from '@prisma/client';
import {
  errorDetails,
  parseId,
  parseOptionalNumber,
  parseOptionalText,
  parsePagination,
  parseRequiredText,
  toFiniteNumber,
  validateIdParam,
} from '../../src/utils/http.utils';

describe('errorDetails', () => {
  it('devuelve el mensaje de un Error normal', () => {
    expect(errorDetails(new Error('algo falló'))).toBe('algo falló');
  });

  it('devuelve el mensaje de un objeto con message y el texto de un string lanzado', () => {
    expect(errorDetails({ message: 'con mensaje' })).toBe('con mensaje');
    expect(errorDetails('texto suelto')).toBe('texto suelto');
  });

  it('no filtra los errores de Prisma: texto genérico (con y sin clase)', () => {
    const known = new Prisma.PrismaClientKnownRequestError('Invalid `prisma.x.create()` invocation', {
      code: 'P2003',
      clientVersion: 'test',
    });
    const validation = new Prisma.PrismaClientValidationError('Unknown argument `foo`', { clientVersion: 'test' });
    const duckTyped = Object.assign(new Error('SQLITE_CONSTRAINT: FOREIGN KEY'), { code: 'P2010' });

    for (const error of [known, validation, duckTyped]) {
      const text = errorDetails(error);
      expect(typeof text).toBe('string');
      expect(text).not.toMatch(/invocation|foo|SQLITE|P20\d\d/);
    }
  });

  it('devuelve un texto fijo cuando no hay nada legible (nunca un objeto)', () => {
    expect(errorDetails(undefined)).toBe('Error desconocido');
    expect(errorDetails(null)).toBe('Error desconocido');
    expect(errorDetails({ interno: 1 })).toBe('Error desconocido');
    expect(errorDetails('   ')).toBe('Error desconocido');
  });
});

describe('parseId', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    [7, 7],
    ['2147483647', 2147483647],
  ])('%p -> %p', (input, expected) => {
    expect(parseId(input)).toBe(expected);
  });

  it.each([
    ['abc'],
    [''],
    ['0'],
    ['-1'],
    ['1.5'],
    ['1e3'],
    [' 5'],
    ['0x10'],
    ['2147483648'],
    ['99999999999999999999'],
    [undefined],
    [null],
    [true],
    [1.5],
    [NaN],
    [['1']],
  ])('%p -> null', (input) => {
    expect(parseId(input)).toBeNull();
  });
});

describe('validateIdParam', () => {
  const run = (value: string) => {
    const json = jest.fn();
    const res: any = { status: jest.fn().mockReturnThis(), json };
    const next = jest.fn();
    validateIdParam({} as any, res, next, value, 'id');
    return { res, json, next };
  };

  it('deja pasar un id válido', () => {
    const { next, res } = run('12');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responde 400 "ID inválido" y no continúa con un id inválido', () => {
    const { next, res, json } = run('abc');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'ID inválido' });
  });
});

describe('parsePagination', () => {
  it('devuelve undefined cuando no vino ni page ni limit', () => {
    expect(parsePagination({})).toBeUndefined();
    expect(parsePagination({ search: 'x' })).toBeUndefined();
  });

  it('usa page=1 y el límite por defecto si solo viene uno', () => {
    expect(parsePagination({ page: '3' }, { defaultLimit: 15 })).toEqual({ page: 3, limit: 15, skip: 30 });
    expect(parsePagination({ limit: '10' })).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('recorta el límite al máximo permitido', () => {
    expect(parsePagination({ page: '1', limit: '100000' }, { maxLimit: 100 })).toEqual({ page: 1, limit: 100, skip: 0 });
  });

  it.each([
    [{ page: '0' }],
    [{ page: 'abc' }],
    [{ limit: '-1' }],
    [{ limit: '1.5' }],
    [{ page: '1', limit: '' }],
  ])('%p -> null (inválido)', (query) => {
    expect(parsePagination(query as any)).toBeNull();
  });
});

describe('validadores de texto y números', () => {
  it('parseRequiredText recorta y rechaza vacío o no-texto', () => {
    expect(parseRequiredText('  Hola  ')).toBe('Hola');
    expect(parseRequiredText('   ')).toBeNull();
    expect(parseRequiredText('')).toBeNull();
    expect(parseRequiredText(5)).toBeNull();
    expect(parseRequiredText(undefined)).toBeNull();
  });

  it('parseOptionalText distingue no enviado, limpiar y texto', () => {
    expect(parseOptionalText(undefined)).toEqual({ valid: true, value: undefined });
    expect(parseOptionalText(null)).toEqual({ valid: true, value: null });
    expect(parseOptionalText('')).toEqual({ valid: true, value: null });
    expect(parseOptionalText('   ')).toEqual({ valid: true, value: null });
    expect(parseOptionalText('  casero ')).toEqual({ valid: true, value: 'casero' });
    expect(parseOptionalText(10)).toEqual({ valid: false });
    expect(parseOptionalText({})).toEqual({ valid: false });
  });

  it('toFiniteNumber acepta números y textos numéricos, nada más', () => {
    expect(toFiniteNumber(7.5)).toBe(7.5);
    expect(toFiniteNumber('7.5')).toBe(7.5);
    expect(toFiniteNumber(0)).toBe(0);
    for (const bad of ['', '  ', 'abc', NaN, Infinity, null, undefined, true, [], {}]) {
      expect(toFiniteNumber(bad)).toBeNull();
    }
  });

  it('parseOptionalNumber: undefined si no se envió, número válido o null si es inválido', () => {
    expect(parseOptionalNumber(undefined)).toBeUndefined();
    expect(parseOptionalNumber(null)).toBeUndefined();
    expect(parseOptionalNumber('')).toBeUndefined();
    expect(parseOptionalNumber('3')).toBe(3);
    expect(parseOptionalNumber(0)).toBe(0);
    expect(parseOptionalNumber(-1)).toBeNull();
    expect(parseOptionalNumber('x')).toBeNull();
    expect(parseOptionalNumber(-1, -5)).toBe(-1);
  });
});
