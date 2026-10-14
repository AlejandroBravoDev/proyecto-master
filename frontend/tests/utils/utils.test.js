import { describe, expect, it } from 'vitest';
import {
  CASH_DENOMINATIONS,
  calculateDenominationsTotal,
  formatCurrency as cajaCurrency,
  formatDateTime,
} from '../../src/app/caja/utils/cajaUtils';
import { formatCurrency as productCurrency, PRODUCT_TYPES, AVAILABILITY_STATUS } from '../../src/app/products/utils/productUtils';
import { formatCurrency as orderCurrency } from '../../src/app/orders/utils/orderUtils';
import {
  ADJUSTMENT_REASONS,
  formatCurrency as inventoryCurrency,
  formatQuantity,
  getStockStatus,
  MEASUREMENT_UNITS,
  REASON_LABELS,
} from '../../src/app/inventory/utils/inventoryUtils';
import { formatCurrency as sharedCurrency } from '../../src/app/common/formatCurrency';
import {
  buildRecipeIngredients,
  isInvalidRecipeRow,
  isSameRecipe,
} from '../../src/app/products/utils/productUtils';
import { formatDate, formatDateForInput, formatRole, isValidPassword6 } from '../../src/app/users/utils/userUtils';
import { formatNumber, formatPercentage, formatCurrency as dashCurrency } from '../../src/app/dashboard/utils/formatters';

describe('cajaUtils', () => {
  it('calculateDenominationsTotal suma valor x cantidad y redondea a 2 decimales', () => {
    expect(calculateDenominationsTotal({ '0.05': 10, '1': 30, '20': 2 })).toBe(70.5);
    expect(calculateDenominationsTotal({ '0.10': 3 })).toBe(0.3); // evita 0.30000000000000004
  });

  it('ignora cantidades inválidas, negativas o claves no numéricas', () => {
    expect(calculateDenominationsTotal({ '1': 0, '5': -2, abc: 4, '10': '3' })).toBe(30);
    expect(calculateDenominationsTotal({})).toBe(0);
    expect(calculateDenominationsTotal()).toBe(0);
  });

  it('el catálogo de denominaciones está ordenado y cubre monedas y billetes', () => {
    const values = CASH_DENOMINATIONS.map((d) => d.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(CASH_DENOMINATIONS.some((d) => d.type === 'COIN')).toBe(true);
    expect(CASH_DENOMINATIONS.some((d) => d.type === 'BILL')).toBe(true);
  });

  it('formatDateTime devuelve cadena vacía sin fecha y contiene el año si la hay', () => {
    expect(formatDateTime('')).toBe('');
    expect(formatDateTime('2026-08-30T14:15:00')).toContain('2026');
  });
});

describe('formatCurrency (un único formateador compartido; known-issues I4)', () => {
  // Antes había copias con es-CO ("US$ 1.299,50") y en-US ("$1,299.50"); ahora todas las pantallas usan es-CO.
  it('las utils de cada feature reexportan el mismo formateador', () => {
    [cajaCurrency, productCurrency, orderCurrency, inventoryCurrency, dashCurrency].forEach((fn) => {
      expect(fn).toBe(sharedCurrency);
    });
  });

  it.each([
    ['caja', cajaCurrency],
    ['productos', productCurrency],
    ['comandas', orderCurrency],
    ['inventario', inventoryCurrency],
    ['dashboard', dashCurrency],
  ])('%s: formato es-CO con 2 decimales', (_name, fn) => {
    expect(fn(1299.5)).toMatch(/US\$\s?1\.299,50/);
    expect(fn(0)).toMatch(/US\$\s?0,00/);
    expect(fn(7.5)).toMatch(/7,50$/);
    expect(fn(-3.456)).toMatch(/3,46$/); // redondea a 2 decimales
  });

  it.each([null, undefined, NaN, '', 'abc', Infinity])('un valor vacío o inválido (%s) se muestra como cero con el mismo formato', (value) => {
    expect(sharedCurrency(value)).toMatch(/US\$\s?0,00/);
  });

  it('acepta importes como texto (el backend de Prisma a veces los serializa así)', () => {
    expect(sharedCurrency('1299.5')).toMatch(/1\.299,50/);
  });
});

describe('productUtils: receta del producto (B10)', () => {
  const rows = [
    { ingredientId: 3, quantity: '2', measurementUnit: 'kg', ingredientName: 'Harina' },
    { ingredientId: 1, quantity: 0.5, measurementUnit: '' },
  ];

  it('buildRecipeIngredients arma el payload del backend y completa la unidad', () => {
    expect(buildRecipeIngredients(rows)).toEqual([
      { ingredientId: 3, quantity: 2, measurementUnit: 'kg' },
      { ingredientId: 1, quantity: 0.5, measurementUnit: 'unidad' },
    ]);
    expect(buildRecipeIngredients()).toEqual([]);
  });

  it('isInvalidRecipeRow detecta sin insumo, cantidad 0, negativa o no numérica', () => {
    expect(isInvalidRecipeRow({ ingredientId: '', quantity: 1 })).toBe(true);
    expect(isInvalidRecipeRow({ ingredientId: 4, quantity: 0 })).toBe(true);
    expect(isInvalidRecipeRow({ ingredientId: 4, quantity: -1 })).toBe(true);
    expect(isInvalidRecipeRow({ ingredientId: 4, quantity: 'abc' })).toBe(true);
    expect(isInvalidRecipeRow({ ingredientId: 4, quantity: 0.25 })).toBe(false);
  });

  it('isSameRecipe ignora el orden y los tipos (texto/número), pero detecta cualquier cambio real', () => {
    const reordered = [rows[1], { ...rows[0], quantity: 2, ingredientName: 'otro nombre' }];
    expect(isSameRecipe(rows, reordered)).toBe(true);
    expect(isSameRecipe([], [])).toBe(true);
    expect(isSameRecipe(undefined, [])).toBe(true);

    expect(isSameRecipe(rows, [rows[0]])).toBe(false); // se quitó un insumo
    expect(isSameRecipe(rows, [rows[0], { ...rows[1], quantity: 1 }])).toBe(false); // cambió la cantidad
    expect(isSameRecipe(rows, [rows[0], { ...rows[1], measurementUnit: 'g' }])).toBe(false); // cambió la unidad
    expect(isSameRecipe([], rows)).toBe(false); // se añadió una receta
  });
});

describe('productUtils', () => {
  it('describe los tipos de producto y la disponibilidad en español', () => {
    expect(PRODUCT_TYPES.PREPARED.shortLabel).toBe('Preparado');
    expect(PRODUCT_TYPES.DIRECT_INVENTORY.label).toBe('Venta Directa');
    expect(AVAILABILITY_STATUS.AVAILABLE.label).toBe('Disponible');
    expect(AVAILABILITY_STATUS.UNAVAILABLE.label).toBe('No Disponible');
  });
});

describe('inventoryUtils', () => {
  it('getStockStatus clasifica agotado, bajo y óptimo', () => {
    expect(getStockStatus(0, 5)).toMatchObject({ status: 'OUT_OF_STOCK', isCritical: true });
    expect(getStockStatus(-2, 5)).toMatchObject({ status: 'OUT_OF_STOCK' });
    expect(getStockStatus(5, 5)).toMatchObject({ status: 'LOW_STOCK', isCritical: true });
    expect(getStockStatus(6, 5)).toMatchObject({ status: 'OPTIMAL', isCritical: false });
  });

  it('getStockStatus tolera textos y valores vacíos', () => {
    expect(getStockStatus('10', '2').status).toBe('OPTIMAL');
    expect(getStockStatus(undefined, undefined).status).toBe('OUT_OF_STOCK');
  });

  it('formatQuantity omite decimales en enteros y añade la unidad', () => {
    expect(formatQuantity(3)).toBe('3');
    expect(formatQuantity(2.5, 'kg')).toBe('2.50 kg');
    expect(formatQuantity('x')).toBe('0');
  });

  it('los motivos de ajuste coinciden con el enum del backend', () => {
    const enumBackend = ['PURCHASE', 'SALE', 'WASTE', 'MANUAL_ADJUSTMENT'];
    expect(Object.keys(REASON_LABELS).sort()).toEqual([...enumBackend].sort());
    ADJUSTMENT_REASONS.forEach((r) => expect(enumBackend).toContain(r.value));
    expect(MEASUREMENT_UNITS.map((u) => u.value)).toContain('unidad');
  });
});

describe('userUtils', () => {
  it('isValidPassword6 exige 6 caracteres sin contar espacios de los bordes', () => {
    expect(isValidPassword6('123456')).toBe(true);
    expect(isValidPassword6('  12345  ')).toBe(false);
    expect(isValidPassword6(undefined)).toBe(false);
  });

  it('formatRole traduce el rol', () => {
    expect(formatRole('ADMIN')).toBe('Administrador');
    expect(formatRole('WORKER')).toBe('Trabajador');
  });

  it('formatDate devuelve guion largo si la fecha no es válida', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('no-es-fecha')).toBe('—');
    expect(formatDate('2026-09-27T12:00:00Z')).toContain('2026');
  });

  it('formatDateForInput devuelve YYYY-MM-DD', () => {
    expect(formatDateForInput('2026-09-27T12:00:00Z')).toBe('2026-09-27');
    expect(formatDateForInput()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(formatDateForInput('basura')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('dashboard formatters', () => {
  it('formatPercentage antepone + a los positivos', () => {
    expect(formatPercentage(2.54)).toBe('+2.5%');
    expect(formatPercentage(-1)).toBe('-1.0%');
    expect(formatPercentage(0)).toBe('0.0%');
  });

  it('formatNumber agrupa miles', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});
