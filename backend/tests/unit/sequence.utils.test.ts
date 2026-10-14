import { nextSequentialCode } from '../../src/utils/sequence.utils';

/** Arma las dependencias del helper sobre una lista de códigos existentes (el último es el de mayor id). */
function fixture(codes: string[]) {
  const rows = codes.map((code, index) => ({ id: index + 1, code }));
  return {
    getLast: async () => (rows.length > 0 ? rows[rows.length - 1] : null),
    exists: async (code: string) => rows.some((row) => row.code === code),
  };
}

describe('nextSequentialCode', () => {
  it('empieza en 0001 cuando no hay registros', async () => {
    expect(await nextSequentialCode({ prefix: 'ORD-', ...fixture([]) })).toBe('ORD-0001');
  });

  it('mantiene los formatos exactos de comandas, facturas y sesiones de caja', async () => {
    expect(await nextSequentialCode({ prefix: 'ORD-', ...fixture(['ORD-0001', 'ORD-0002']) })).toBe('ORD-0003');
    expect(await nextSequentialCode({ prefix: 'INV-2026-', ...fixture(['INV-2026-0009']) })).toBe('INV-2026-0010');
    expect(await nextSequentialCode({ prefix: 'CAJA-2026-', ...fixture(['CAJA-2026-0099']) })).toBe('CAJA-2026-0100');
  });

  it('usa el mayor entre (último id + 1) y (último sufijo + 1)', async () => {
    // sufijo heredado más alto que el id
    expect(await nextSequentialCode({ prefix: 'ORD-', ...fixture(['ORD-0050']) })).toBe('ORD-0051');
    // id más alto que el sufijo (hubo borrados): 3 filas pero el último código es ORD-0001
    const rows = [{ id: 7, code: 'ORD-0001' }];
    const code = await nextSequentialCode({
      prefix: 'ORD-',
      getLast: async () => rows[0],
      exists: async (c) => rows.some((r) => r.code === c),
    });
    expect(code).toBe('ORD-0008');
  });

  it('salta los códigos ya existentes', async () => {
    const taken = new Set(['ORD-0003', 'ORD-0004']);
    const code = await nextSequentialCode({
      prefix: 'ORD-',
      getLast: async () => ({ id: 2, code: 'ORD-0002' }),
      exists: async (c) => taken.has(c),
    });
    expect(code).toBe('ORD-0005');
  });

  it('ignora un último código sin sufijo numérico y respeta el relleno', async () => {
    expect(
      await nextSequentialCode({ prefix: 'X-', pad: 6, getLast: async () => ({ id: 4, code: 'sin-numero' }), exists: async () => false })
    ).toBe('X-000005');
    expect(
      await nextSequentialCode({ prefix: 'X-', getLast: async () => ({ id: 1, code: null }), exists: async () => false })
    ).toBe('X-0002');
  });
});
