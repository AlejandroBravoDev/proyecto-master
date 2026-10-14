import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination, { ITEMS_PER_PAGE } from '../../src/app/common/Pagination';

describe('<Pagination />', () => {
  it('no renderiza nada cuando no hay registros', () => {
    const { container } = render(<Pagination totalItems={0} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra el rango "Mostrando 1–15 de 40 registros" con 15 por página', () => {
    expect(ITEMS_PER_PAGE).toBe(15);
    render(<Pagination currentPage={1} totalItems={40} onPageChange={() => {}} />);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent('Mostrando 1–15 de 40 registros');
  });

  it('la última página muestra el resto (31–40)', () => {
    render(<Pagination currentPage={3} totalItems={40} onPageChange={() => {}} />);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent('31–40 de 40');
  });

  it('deshabilita Anterior en la primera página y Siguiente en la última', () => {
    const { rerender } = render(<Pagination currentPage={1} totalItems={40} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled();

    rerender(<Pagination currentPage={3} totalItems={40} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled();
  });

  it('llama a onPageChange con la página elegida, la anterior y la siguiente', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination currentPage={2} totalItems={40} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: '3' }));
    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));

    expect(onPageChange.mock.calls.map((c) => c[0])).toEqual([3, 1, 3]);
  });

  it('corrige una página fuera de rango', () => {
    render(<Pagination currentPage={99} totalItems={20} onPageChange={() => {}} />);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent('16–20 de 20');
  });

  it('con muchas páginas abrevia con puntos suspensivos', () => {
    render(<Pagination currentPage={5} totalItems={15 * 12} onPageChange={() => {}} />);
    expect(screen.getAllByText('...').length).toBe(2);
    expect(screen.getByRole('button', { name: '12' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
  });
});
