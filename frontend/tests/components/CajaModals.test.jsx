import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OpenCajaModal from '../../src/app/caja/components/OpenCajaModal';
import CloseCajaModal from '../../src/app/caja/components/CloseCajaModal';
import { confirmDialog } from '../../src/app/common/alertUtils';
import { renderAsAdmin } from '../helpers/renderWithApp';

vi.mock('../../src/app/common/alertUtils', () => ({
  showSuccessToast: vi.fn(),
  showErrorAlert: vi.fn(),
  confirmDialog: vi.fn(),
}));

// El contador de denominaciones se comparte entre apertura y cierre de caja: estas pruebas fijan que
// ambos modales se comportan igual (caja maneja dinero, por eso se prueba el cálculo y el payload).
// Orden de los campos numéricos: monedas 0.05, 0.10, 0.25, 0.50, 1.00 y billetes 2, 5, 10, 20, 50, 100.
const COIN_5_CENTS = 0;
const BILL_20 = 8;

const ALL_ZERO = {
  '0.05': 0, '0.1': 0, '0.25': 0, '0.5': 0, '1': 0, '2': 0, '5': 0, '10': 0, '20': 0, '50': 0, '100': 0,
};

const ACTIVE_SESSION = {
  id: 7,
  sessionNumber: 'CAJA-0007',
  initialAmount: 25,
  openedByUser: { fullName: 'Administrador' },
  notes: 'Base entregada por gerencia',
};

const openModal = (props = {}) => {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  const onClose = props.onClose ?? vi.fn();
  const utils = renderAsAdmin(<OpenCajaModal isOpen onClose={onClose} onSubmit={onSubmit} {...props} />);
  return { onSubmit, onClose, user: userEvent.setup({ delay: null }), ...utils };
};

const closeModal = (props = {}) => {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  const onClose = props.onClose ?? vi.fn();
  const utils = renderAsAdmin(
    <CloseCajaModal isOpen onClose={onClose} onSubmit={onSubmit} activeSession={ACTIVE_SESSION} {...props} />
  );
  return { onSubmit, onClose, user: userEvent.setup({ delay: null }), ...utils };
};

const totalOf = (label) => screen.getByText(label).parentElement;

beforeEach(() => {
  vi.clearAllMocks();
  confirmDialog.mockResolvedValue({ isConfirmed: true });
});

describe('<OpenCajaModal />', () => {
  it('no renderiza nada si está cerrado', () => {
    const { container } = renderAsAdmin(<OpenCajaModal isOpen={false} onClose={() => {}} onSubmit={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('empieza con base 0 y el botón de abrir deshabilitado', () => {
    openModal();
    expect(screen.getByRole('heading', { name: 'Apertura de Caja Registradora' })).toBeInTheDocument();
    expect(totalOf('Base Inicial Total')).toHaveTextContent(/0,00/);
    expect(screen.getByRole('button', { name: /Iniciar Turno de Caja/ })).toBeDisabled();
  });

  it('suma monedas y billetes en vivo (botones +5/+1 y campos numéricos)', async () => {
    const { user } = openModal();
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(11);

    await user.click(screen.getAllByRole('button', { name: '+5' })[COIN_5_CENTS]); // 5 x 0.05 = 0.25
    await user.type(inputs[BILL_20], '3'); // 3 x 20 = 60

    expect(totalOf('Base Inicial Total')).toHaveTextContent(/60,25/);
    expect(screen.getByRole('button', { name: /Iniciar Turno de Caja/ })).toBeEnabled();
  });

  it('restar no baja de cero', async () => {
    const { user } = openModal();
    await user.click(screen.getAllByRole('button', { name: '-5' })[COIN_5_CENTS]);
    await user.click(screen.getAllByRole('button', { name: '-1' })[0]);
    expect(totalOf('Base Inicial Total')).toHaveTextContent(/0,00/);
    expect(screen.getAllByRole('spinbutton')[COIN_5_CENTS]).toHaveValue(null);
  });

  it('envía las denominaciones, las notas y el usuario, y cierra', async () => {
    const { onSubmit, onClose, user } = openModal();
    await user.click(screen.getAllByRole('button', { name: '+5' })[COIN_5_CENTS]);
    await user.type(screen.getAllByRole('spinbutton')[BILL_20], '3');
    await user.type(screen.getByPlaceholderText(/Apertura turno matutino/), '  turno mañana  ');
    await user.click(screen.getByRole('button', { name: /Iniciar Turno de Caja/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      denominations: { ...ALL_ZERO, '0.05': 5, '20': 3 },
      notes: 'turno mañana',
      userId: 1,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sin notas envía notes undefined', async () => {
    const { onSubmit, user } = openModal();
    await user.click(screen.getAllByRole('button', { name: '+1' })[0]);
    await user.click(screen.getByRole('button', { name: /Iniciar Turno de Caja/ }));
    expect(onSubmit.mock.calls[0][0].notes).toBeUndefined();
    expect(onSubmit.mock.calls[0][0].denominations['2']).toBe(1);
  });

  it('anti doble envío: dos clics seguidos = una sola llamada', async () => {
    let release;
    const onSubmit = vi.fn(() => new Promise((resolve) => (release = resolve)));
    const { user } = openModal({ onSubmit });
    await user.click(screen.getAllByRole('button', { name: '+1' })[0]);

    await user.click(screen.getByRole('button', { name: /Iniciar Turno de Caja/ }));
    await user.click(screen.getByRole('button', { name: /Abriendo caja/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    release();
  });

  it('si onSubmit falla muestra el error y no cierra', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Ya existe una caja abierta.'));
    const { onClose, user } = openModal({ onSubmit });
    await user.click(screen.getAllByRole('button', { name: '+1' })[0]);
    await user.click(screen.getByRole('button', { name: /Iniciar Turno de Caja/ }));

    expect(await screen.findByText('Ya existe una caja abierta.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Iniciar Turno de Caja/ })).toBeEnabled();
  });

  it('al reabrir se reinician los conteos', async () => {
    const { user, rerender } = openModal();
    await user.click(screen.getAllByRole('button', { name: '+1' })[0]);
    expect(totalOf('Base Inicial Total')).toHaveTextContent(/2,00/);

    rerender(<OpenCajaModal isOpen={false} onClose={() => {}} onSubmit={() => {}} />);
    rerender(<OpenCajaModal isOpen onClose={() => {}} onSubmit={() => {}} />);
    expect(totalOf('Base Inicial Total')).toHaveTextContent(/0,00/);
  });
});

describe('<CloseCajaModal />', () => {
  it('no renderiza nada sin sesión activa o cerrado', () => {
    const closed = renderAsAdmin(<CloseCajaModal isOpen={false} onClose={() => {}} onSubmit={() => {}} activeSession={ACTIVE_SESSION} />);
    expect(closed.container).toBeEmptyDOMElement();
    closed.unmount();

    const noSession = renderAsAdmin(<CloseCajaModal isOpen onClose={() => {}} onSubmit={() => {}} activeSession={null} />);
    expect(noSession.container).toBeEmptyDOMElement();
  });

  it('muestra la sesión activa y empieza con total 0', () => {
    closeModal();
    expect(screen.getByRole('heading', { name: /Cierre de Caja \(CAJA-0007\)/ })).toBeInTheDocument();
    expect(totalOf('Base Inicial de Apertura')).toHaveTextContent(/25,00/);
    expect(totalOf('Total Contado en Caja')).toHaveTextContent(/0,00/);
  });

  it('suma monedas y billetes igual que la apertura', async () => {
    const { user } = closeModal();
    await user.click(screen.getAllByRole('button', { name: '+5' })[COIN_5_CENTS]);
    await user.type(screen.getAllByRole('spinbutton')[BILL_20], '3');
    expect(totalOf('Total Contado en Caja')).toHaveTextContent(/60,25/);
  });

  it('pide confirmación con el total y, si se confirma, envía el payload y cierra', async () => {
    const { onSubmit, onClose, user } = closeModal();
    await user.click(screen.getAllByRole('button', { name: '+5' })[COIN_5_CENTS]);
    await user.type(screen.getAllByRole('spinbutton')[BILL_20], '3');
    await user.type(screen.getByPlaceholderText(/Cierre de jornada/), 'cuadró');
    await user.click(screen.getByRole('button', { name: /Confirmar Cierre de Caja/ }));

    expect(confirmDialog).toHaveBeenCalledTimes(1);
    expect(confirmDialog.mock.calls[0][0].text).toMatch(/60,25/);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      denominations: { ...ALL_ZERO, '0.05': 5, '20': 3 },
      closingNotes: 'cuadró',
      userId: 1,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('si el usuario cancela la confirmación no se envía nada y puede reintentar', async () => {
    confirmDialog.mockResolvedValueOnce({ isConfirmed: false });
    const { onSubmit, user } = closeModal();
    await user.click(screen.getAllByRole('button', { name: '+1' })[0]);

    await user.click(screen.getByRole('button', { name: /Confirmar Cierre de Caja/ }));
    expect(onSubmit).not.toHaveBeenCalled();

    // la bandera anti doble envío se liberó: un segundo intento (ahora confirmado) sí envía
    await user.click(screen.getByRole('button', { name: /Confirmar Cierre de Caja/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].denominations['2']).toBe(1);
  });

  it('si onSubmit falla muestra el error y no cierra', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('No hay una caja abierta.'));
    const { onClose, user } = closeModal({ onSubmit });
    await user.click(screen.getByRole('button', { name: /Confirmar Cierre de Caja/ }));

    expect(await screen.findByText('No hay una caja abierta.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('al reabrir se reinician los conteos', async () => {
    const { user, rerender } = closeModal();
    await user.click(screen.getAllByRole('button', { name: '+1' })[0]);
    expect(totalOf('Total Contado en Caja')).toHaveTextContent(/2,00/);

    const props = { onClose: () => {}, onSubmit: () => {}, activeSession: ACTIVE_SESSION };
    rerender(<CloseCajaModal isOpen={false} {...props} />);
    rerender(<CloseCajaModal isOpen {...props} />);
    expect(totalOf('Total Contado en Caja')).toHaveTextContent(/0,00/);
  });
});
