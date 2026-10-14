import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StockAdjustmentModal from '../../src/app/inventory/components/StockAdjustmentModal';

const INGREDIENT = {
  id: 7,
  name: 'Carne de Res 150g',
  measurementUnit: 'unidad',
  currentStock: 20,
  unitCost: 1.5,
};

function setup(props = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup({ delay: null });
  render(<StockAdjustmentModal isOpen onClose={() => {}} onSubmit={onSubmit} ingredient={INGREDIENT} {...props} />);
  return { onSubmit, user };
}

describe('<StockAdjustmentModal /> costo unitario según rol (B12)', () => {
  it('para el administrador envía adjustStock, adjustReason y unitCost', async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByPlaceholderText('Ej. 10, 2.5'), '5');
    await user.click(screen.getByRole('button', { name: /aplicar ajuste/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(7, { adjustStock: 5, adjustReason: 'PURCHASE', unitCost: 1.5 });
  });

  it('para el trabajador NO envía unitCost (el servidor solo admite adjustStock y adjustReason) ni muestra el campo', async () => {
    const { onSubmit, user } = setup({ canEditUnitCost: false });
    expect(screen.queryByText(/Nuevo Costo Unitario de Compra/)).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Ej. 10, 2.5'), '5');
    await user.click(screen.getByRole('button', { name: /aplicar ajuste/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][1];
    expect(payload).toEqual({ adjustStock: 5, adjustReason: 'PURCHASE' });
    expect(Object.keys(payload)).not.toContain('unitCost');
  });
});
