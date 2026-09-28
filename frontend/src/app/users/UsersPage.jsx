import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import UsersHeader from './components/UsersHeader';
import UsersTable from './components/UsersTable';
import UserModal from './components/UserModal';
import PasswordResetModal from './components/PasswordResetModal';
import {
  fetchUsers,
  createUser,
  updateUser,
  updateUserPassword,
  updateUserStatus,
} from './services/userService';
import { confirmDialog, showErrorAlert, showSuccessToast } from '../common/alertUtils';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal States
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);

  const loadUsers = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchUsers(currentPage, 15)
      .then((data) => {
        const list = Array.isArray(data) ? data : data.users || [];
        setUsers(list);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total !== undefined ? data.total : list.length);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'No se pudieron cargar los trabajadores.');
        setLoading(false);
      });
  }, [currentPage]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Client-side search filtering
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  // Create / Edit User Handler
  const handleUserSubmit = async (payload) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, payload);
        showSuccessToast(`Trabajador "${payload.fullName}" actualizado correctamente.`);
      } else {
        await createUser(payload);
        showSuccessToast(`Trabajador "${payload.fullName}" registrado exitosamente.`);
      }
      loadUsers();
    } catch (err) {
      showErrorAlert('Error al guardar trabajador', err.message || 'No se pudo completar la operación.');
      throw err;
    }
  };

  // Reassign Password Handler
  const handlePasswordSubmit = async (userId, newPassword) => {
    try {
      await updateUserPassword(userId, newPassword);
      showSuccessToast('Contraseña reasignada exitosamente.');
    } catch (err) {
      showErrorAlert('Error al reasignar contraseña', err.message || 'No se pudo actualizar la contraseña.');
      throw err;
    }
  };

  // Toggle Active / Inactive Status Handler
  const handleToggleStatus = async (user) => {
    const isCurrentlyActive = Boolean(user.active);
    const nextState = !isCurrentlyActive;
    const actionText = nextState ? 'activar' : 'desactivar';

    const result = await confirmDialog({
      title: `¿${nextState ? 'Activar' : 'Desactivar'} a "${user.fullName}"?`,
      text: nextState
        ? 'El trabajador podrá volver a iniciar sesión en los terminales del POS.'
        : 'El trabajador no podrá ingresar al sistema hasta que sea reactivado.',
      confirmButtonText: `Sí, ${actionText}`,
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      try {
        await updateUserStatus(user.id, nextState);
        showSuccessToast(`Trabajador ${nextState ? 'activado' : 'desactivado'} con éxito.`);
        loadUsers();
      } catch (err) {
        showErrorAlert('Error al cambiar estado', err.message || 'No se pudo cambiar el estado del usuario.');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8 animate-fade-in">
      {/* 1. Header Card with actions */}
      <UsersHeader
        onNewUserClick={() => {
          setEditingUser(null);
          setUserModalOpen(true);
        }}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        totalCount={totalCount}
      />

      {/* 2. Main Content / Users Table */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-rose-800 shadow-sm">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-[#E63946] shrink-0" />
            <div>
              <p className="font-bold text-[#584235]">Error al cargar usuarios</p>
              <p className="text-xs text-rose-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={loadUsers}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reintentar</span>
          </button>
        </div>
      ) : (
        <UsersTable
          users={filteredUsers}
          onEdit={(u) => {
            setEditingUser(u);
            setUserModalOpen(true);
          }}
          onResetPassword={(u) => {
            setSelectedUserForPassword(u);
            setPasswordModalOpen(true);
          }}
          onToggleStatus={handleToggleStatus}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Modal: Create or Edit User */}
      <UserModal
        isOpen={userModalOpen}
        onClose={() => {
          setUserModalOpen(false);
          setEditingUser(null);
        }}
        initialData={editingUser}
        onSubmit={handleUserSubmit}
      />

      {/* Modal: Reassign Password */}
      <PasswordResetModal
        isOpen={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false);
          setSelectedUserForPassword(null);
        }}
        user={selectedUserForPassword}
        onSubmit={handlePasswordSubmit}
      />
    </div>
  );
}
