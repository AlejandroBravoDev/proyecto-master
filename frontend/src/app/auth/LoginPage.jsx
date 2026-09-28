import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Utensils, Lock, User, Eye, EyeOff, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from './AuthContext';
import { showSuccessToast } from '../common/alertUtils';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isSubmittingRef = useRef(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || isSubmittingRef.current) return;

    setError('');

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError('Por favor ingresa tu nombre de usuario.');
      return;
    }

    if (!password) {
      setError('Por favor ingresa tu contraseña.');
      return;
    }

    if (!/^[a-zA-Z0-9]{6}$/.test(password)) {
      setError('La contraseña debe tener exactamente 6 caracteres (letras o números).');
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);

    try {
      const user = await login(cleanUsername, password);
      showSuccessToast(`¡Bienvenido, ${user.fullName || user.username}!`);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-radial from-[#383C3D] via-[#2E3132] to-[#1E2021] p-4 font-['Istok_Web']">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden animate-fade-in">
        {/* Header Branding Card */}
        <div className="bg-[#2E3132] p-8 text-center relative overflow-hidden">
          {/* Subtle Glow */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#E63946]/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-[#FF7A00]/15 rounded-full blur-2xl pointer-events-none" />

          {/* Logo Badge */}
          <div className="w-16 h-16 rounded-3xl bg-[#E63946] mx-auto flex items-center justify-center text-white shadow-xl shadow-red-900/40 border border-white/20 mb-3 transform hover:scale-105 transition-transform duration-300">
            <Utensils className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-black text-white tracking-wide">
            Master<span className="text-[#E63946]">Food</span>
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-1">
            Sistema Punto de Venta (POS) & Control de Restaurante
          </p>
        </div>

        {/* Login Form Body */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-[#584235]">Iniciar Sesión</h2>
            <p className="text-xs text-slate-400">
              Ingresa tus credenciales de acceso para entrar al sistema
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946] flex items-center space-x-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#584235] uppercase tracking-wider block">
              Usuario <span className="text-[#E63946]">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. admin o tu usuario"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#584235] uppercase tracking-wider block">
              Contraseña (6 caracteres) <span className="text-[#E63946]">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                maxLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Exactamente 6 caracteres"
                className="w-full pl-10 pr-11 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Nota: La contraseña debe componerse de exactamente 6 letras o números.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full mt-2 flex items-center justify-center space-x-2 py-3.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-sm font-bold shadow-lg shadow-red-500/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Validando credenciales...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Ingresar al Sistema</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
          <span className="text-[11px] text-slate-400 font-semibold">
            MasterFood POS System · Acceso Seguro
          </span>
        </div>
      </div>
    </div>
  );
}
