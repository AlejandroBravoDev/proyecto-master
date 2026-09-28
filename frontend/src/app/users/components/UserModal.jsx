import React, { useState, useEffect, useRef } from 'react';
import { X, UserPlus, Edit3, Lock, Eye, EyeOff, AlertCircle, RefreshCw, Calendar, ShieldCheck, User } from 'lucide-react';
import { formatDateForInput, isValidPassword6 } from '../utils/userUtils';

export default function UserModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const isEditing = Boolean(initialData);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('WORKER');
  const [joinedAt, setJoinedAt] = useState(formatDateForInput());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    isSubmittingRef.current = false;
    if (isOpen) {
      setError('');
      setShowPassword(false);
      if (initialData) {
        setFullName(initialData.fullName || '');
        setUsername(initialData.username || '');
        setRole(initialData.role || 'WORKER');
        setJoinedAt(formatDateForInput(initialData.joinedAt));
        setPassword('');
      } else {
        setFullName('');
        setUsername('');
        setRole('WORKER');
        setJoinedAt(formatDateForInput());
        setPassword('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || isSubmittingRef.current) return;

    setError('');

    const cleanFullName = fullName.trim();
    const cleanUsername = username.trim();

    if (!cleanFullName) {
      setError('El nombre completo es obligatorio.');
      return;
    }

    if (!cleanUsername) {
      setError('El nombre de usuario es obligatorio.');
      return;
    }

    if (!isEditing) {
      if (!password) {
        setError('Debes asignar una contraseña para el nuevo trabajador.');
        return;
      }
      if (!isValidPassword6(password)) {
        setError('La contraseña debe tener exactamente 6 caracteres alfanuméricos (letras o números).');
        return;
      }
    }

    isSubmittingRef.current = true;
    setSaving(true);

    try {
      const payload = {
        fullName: cleanFullName,
        username: cleanUsername,
        role,
        joinedAt: new Date(joinedAt).toISOString(),
        ...(isEditing ? {} : { password }),
      };

      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar el usuario.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#E63946] flex items-center justify-center">
              {isEditing ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">
                {isEditing ? 'Editar Datos del Trabajador' : 'Registrar Nuevo Trabajador'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing ? 'Actualiza la información del personal' : 'Crea un nuevo usuario de acceso para el POS'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946] flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#584235] uppercase tracking-wider block">
              Nombre Completo <span className="text-[#E63946]">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Carlos Mendoza, Ana Torres"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white font-medium"
                required
              />
            </div>
          </div>

          {/* Username & Role Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Username */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#584235] uppercase tracking-wider block">
                Usuario de Acceso <span className="text-[#E63946]">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. carlosm, anatorres"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white font-medium lowercase"
                required
              />
            </div>

            {/* Role */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#584235] uppercase tracking-wider block">
                Rol en el Sistema <span className="text-[#E63946]">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white font-medium cursor-pointer"
              >
                <option value="WORKER">Trabajador (Cajero/Operador)</option>
                <option value="ADMIN">Administrador (Control Total)</option>
              </select>
            </div>
          </div>

          {/* Joined Date */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#584235] uppercase tracking-wider block">
              Fecha de Ingreso / Contratación
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={joinedAt}
                onChange={(e) => setJoinedAt(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white font-medium"
              />
            </div>
          </div>

          {/* Password (Only in create mode) */}
          {!isEditing && (
            <div className="space-y-1 pt-1">
              <label className="text-xs font-bold text-[#584235] uppercase tracking-wider block">
                Contraseña Inicial (Exactamente 6 caracteres) <span className="text-[#E63946]">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  maxLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 caracteres alfanuméricos"
                  className="w-full pl-10 pr-11 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white font-mono font-bold"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showPassword ? 'Ocultar' : 'Ver'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                La contraseña debe componerse de exactamente 6 letras o números.
              </p>
            </div>
          )}

          {isEditing && (
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-800 space-y-0.5">
              <span className="font-bold block">💡 Cambio de contraseña:</span>
              <p>
                Para cambiar la contraseña de este trabajador, usa la opción <strong>"Reasignar Contraseña"</strong> directamente desde la tabla de usuarios.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Registrar Trabajador'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
