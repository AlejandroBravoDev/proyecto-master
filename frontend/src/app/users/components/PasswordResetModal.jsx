import React, { useState, useEffect, useRef } from 'react';
import { X, KeyRound, Lock, Eye, EyeOff, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { isValidPassword6 } from '../utils/userUtils';

export default function PasswordResetModal({
  isOpen,
  onClose,
  user = null,
  onSubmit,
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    isSubmittingRef.current = false;
    if (isOpen) {
      setPassword('');
      setError('');
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || isSubmittingRef.current) return;

    setError('');

    if (!password) {
      setError('Por favor ingresa la nueva contraseña.');
      return;
    }

    if (!isValidPassword6(password)) {
      setError('La contraseña debe tener exactamente 6 caracteres alfanuméricos (letras o números).');
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);

    try {
      await onSubmit(user.id, password);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al reasignar la contraseña.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">Reasignar Contraseña</h2>
              <p className="text-xs text-slate-400">Actualiza las credenciales de acceso</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Worker Badge */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Trabajador</span>
            <span className="text-xs font-bold text-[#584235]">{user.fullName}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Usuario</span>
            <span className="text-xs font-bold text-[#584235] font-mono">@{user.username}</span>
          </div>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946] flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#584235] uppercase tracking-wider block">
              Nueva Contraseña (6 caracteres) <span className="text-[#E63946]">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                maxLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Exactamente 6 caracteres"
                className="w-full pl-10 pr-11 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white font-mono font-bold"
                required
                autoFocus
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
              Usa exactamente 6 letras o números (sin espacios ni símbolos especiales).
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
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
              disabled={saving || !password}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Guardando...' : 'Reasignar Contraseña'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
