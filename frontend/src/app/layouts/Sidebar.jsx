import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  Box,
  Wallet,
  Users,
  ChevronLeft,
  ChevronRight,
  Utensils,
  LogOut,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { confirmDialog, showSuccessToast } from '../common/alertUtils';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Productos', path: '/productos', icon: UtensilsCrossed },
    { name: 'Comandas', path: '/comandas', icon: ClipboardList },
    { name: 'Inventario', path: '/inventario', icon: Box },
    { name: 'Caja', path: '/caja', icon: Wallet },
    ...(isAdmin ? [{ name: 'Usuarios', path: '/usuarios', icon: Users }] : []),
  ];

  const handleLogout = async () => {
    const result = await confirmDialog({
      title: '¿Cerrar sesión?',
      text: 'Se cerrará la sesión actual en este terminal.',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Permanecer',
    });

    if (result.isConfirmed) {
      logout();
      showSuccessToast('Sesión finalizada.');
      navigate('/login', { replace: true });
    }
  };

  return (
    <aside
      className={`relative h-[calc(100vh-2rem)] my-4 ml-4 rounded-3xl bg-[#2E3132] text-[#F9FAFA] transition-all duration-300 flex flex-col shadow-2xl z-30 shrink-0 select-none ${
        collapsed ? 'w-20 p-3' : 'w-64 p-5'
      }`}
    >
      {/* Header section: Logo & Toggle Button */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-700/60 mb-5 shrink-0">
        <div className="flex items-center space-x-3 overflow-hidden">
          {/* Circular Red MasterFood Badge */}
          <div className="w-10 h-10 rounded-full bg-[#E63946] flex items-center justify-center shrink-0 shadow-md shadow-red-900/30 border border-white/20">
            <Utensils className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight whitespace-nowrap overflow-hidden">
              <span className="font-bold text-lg tracking-wide text-white">
                Master<span className="text-[#E63946]">Food</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">POS System</span>
            </div>
          )}
        </div>

        {/* Toggle Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-full hover:bg-slate-700/80 text-slate-300 hover:text-white transition-colors border border-slate-600/40 cursor-pointer"
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 space-y-2 overflow-y-auto pr-0.5 scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.name : undefined}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-[#E63946] text-white shadow-lg shadow-red-600/30'
                  : 'text-[#F9FAFA] hover:bg-slate-700/50 hover:text-white'
              } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout Section (Fixed Bottom) */}
      <div className="pt-4 border-t border-slate-700/60 mt-auto shrink-0 space-y-2">
        {!collapsed ? (
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-[#E63946]/20 text-[#E63946] flex items-center justify-center font-black text-xs shrink-0 border border-[#E63946]/30">
                {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              </div>
              <div className="overflow-hidden leading-tight">
                <p className="text-xs font-bold text-white truncate">
                  {user?.fullName || user?.username || 'Usuario'}
                </p>
                <span className="text-[10px] font-bold text-slate-400 block">
                  {isAdmin ? 'Administrador' : 'Trabajador'}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 py-2 rounded-xl bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <div
              className="w-9 h-9 rounded-xl bg-white/5 text-slate-300 flex items-center justify-center text-xs font-bold border border-white/10"
              title={`${user?.fullName || user?.username || 'Usuario'} (${isAdmin ? 'Admin' : 'Trabajador'})`}
            >
              {isAdmin ? <ShieldCheck className="w-4 h-4 text-amber-400" /> : <UserCheck className="w-4 h-4 text-emerald-400" />}
            </div>
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-xl hover:bg-rose-600 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
