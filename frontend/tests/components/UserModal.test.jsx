import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserModal from '../../src/app/users/components/UserModal';

const NAME = /Carlos Mendoza/; // placeholders: las etiquetas de este formulario no están asociadas a los campos
const USERNAME = /carlosm/;
const PASSWORD = /Mínimo 6 caracteres/;

function setup(props = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  const onClose = props.onClose ?? vi.fn();
  const user = userEvent.setup();
  const utils = render(<UserModal isOpen onClose={onClose} onSubmit={onSubmit} {...props} />);
  return { onSubmit, onClose, user, ...utils };
}

async function fillNew(user, { fullName = 'Ana Torres', username = 'anat', password = 'clave123' } = {}) {
  if (fullName) await user.type(screen.getByPlaceholderText(NAME), fullName);
  if (username) await user.type(screen.getByPlaceholderText(USERNAME), username);
  if (password) await user.type(screen.getByPlaceholderText(PASSWORD), password);
}

describe('<UserModal /> crear', () => {
  it('no renderiza nada si está cerrado', () => {
    const { container } = render(<UserModal isOpen={false} onClose={() => {}} onSubmit={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra el título y el botón de registro', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Registrar Nuevo Trabajador' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrar Trabajador/ })).toBeInTheDocument();
  });

  it('rechaza un nombre de solo espacios sin llamar a onSubmit', async () => {
    const { onSubmit, user } = setup();
    await fillNew(user, { fullName: '   ' });
    await user.click(screen.getByRole('button', { name: /Registrar Trabajador/ }));

    expect(await screen.findByText('El nombre completo es obligatorio.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña de menos de 6 caracteres', async () => {
    const { onSubmit, user } = setup();
    await fillNew(user, { password: '123' });
    await user.click(screen.getByRole('button', { name: /Registrar Trabajador/ }));

    // El mismo texto está en la ayuda fija del campo y en el banner de error: tras validar aparecen ambos
    const matches = await screen.findAllByText('La contraseña debe tener al menos 6 caracteres.');
    expect(matches.length).toBe(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía el payload limpio, con rol por defecto WORKER, y cierra', async () => {
    const { onSubmit, onClose, user } = setup();
    await fillNew(user, { fullName: '  Ana Torres  ', username: ' anat ' });
    await user.click(screen.getByRole('button', { name: /Registrar Trabajador/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      fullName: 'Ana Torres',
      username: 'anat',
      role: 'WORKER',
      password: 'clave123',
    });
    expect(onSubmit.mock.calls[0][0].joinedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('permite elegir el rol Administrador', async () => {
    const { onSubmit, user } = setup();
    await fillNew(user);
    await user.selectOptions(screen.getByRole('combobox'), 'ADMIN');
    await user.click(screen.getByRole('button', { name: /Registrar Trabajador/ }));
    expect(onSubmit.mock.calls[0][0].role).toBe('ADMIN');
  });

  it('anti doble envío: dos clics seguidos = una sola llamada', async () => {
    let release;
    const onSubmit = vi.fn(() => new Promise((resolve) => (release = resolve)));
    const { user } = setup({ onSubmit });
    await fillNew(user);

    const save = screen.getByRole('button', { name: /Registrar Trabajador/ });
    await user.click(save);
    await user.click(screen.getByRole('button', { name: /Guardando/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    release();
  });

  it('si onSubmit falla muestra el error del servidor y no cierra', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('El nombre de usuario ya está registrado.'));
    const { onClose, user } = setup({ onSubmit });
    await fillNew(user);
    await user.click(screen.getByRole('button', { name: /Registrar Trabajador/ }));

    expect(await screen.findByText('El nombre de usuario ya está registrado.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // y el botón vuelve a estar disponible para reintentar
    expect(screen.getByRole('button', { name: /Registrar Trabajador/ })).toBeEnabled();
  });

  it('el botón del ojo alterna la contraseña', async () => {
    const { user } = setup();
    const input = screen.getByPlaceholderText(PASSWORD);
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByTitle('Ver'));
    expect(input).toHaveAttribute('type', 'text');
  });
});

describe('<UserModal /> editar', () => {
  const initialData = { id: 5, fullName: 'Luis Gómez', username: 'luisg', role: 'ADMIN', joinedAt: '2026-03-15T12:00:00.000Z' };

  it('precarga los datos y no pide contraseña', () => {
    setup({ initialData });
    expect(screen.getByRole('heading', { name: 'Editar Datos del Trabajador' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(NAME)).toHaveValue('Luis Gómez');
    expect(screen.getByPlaceholderText(USERNAME)).toHaveValue('luisg');
    expect(screen.getByRole('combobox')).toHaveValue('ADMIN');
    expect(screen.queryByPlaceholderText(PASSWORD)).not.toBeInTheDocument();
  });

  it('no incluye contraseña en el payload al editar', async () => {
    const { onSubmit, user } = setup({ initialData });
    await user.click(screen.getByRole('button', { name: /Guardar Cambios/ }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('password');
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ fullName: 'Luis Gómez', role: 'ADMIN' });
  });

  it('al reabrir con otro usuario se reinicia el formulario', () => {
    const { rerender } = setup({ initialData });
    rerender(<UserModal isOpen onClose={() => {}} onSubmit={() => {}} initialData={{ ...initialData, fullName: 'Otra Persona' }} />);
    expect(screen.getByPlaceholderText(NAME)).toHaveValue('Otra Persona');
  });
});
