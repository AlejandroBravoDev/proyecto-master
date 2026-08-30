import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  Box,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Utensils
} from 'lucide-react';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Productos', path: '/productos', icon: UtensilsCrossed },
    { name: 'Comandas', path: '/comandas', icon: ClipboardList },
    { name: 'Inventario', path: '/inventario', icon: Box },
    { name: 'Caja', path: '/caja', icon: Wallet },
  ];

  return (
    <aside
      className={`relative min-h-[calc(100vh-2rem)] my-4 ml-4 rounded-3xl bg-[#2E3132] text-[#F9FAFA] transition-all duration-300 flex flex-col shadow-2xl z-30 shrink-0 ${
        collapsed ? 'w-20 p-3' : 'w-64 p-5'
      }`}
    >
      {/* Header section: Logo & Toggle Button */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-700/60 mb-6">
        <div className="flex items-center space-x-3 overflow-hidden">
          {/* Circular Red MasterFood Badge */}
          <div className="w-10 h-10 rounded-full bg-[#E63946] flex items-center justify-center shrink-0 shadow-md shadow-red-900/30 border border-white/20">
            <Utensils className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight whitespace-nowrap">
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
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-[#E63946] text-white shadow-lg shadow-red-600/30'
                  : 'text-[#F9FAFA] hover:bg-slate-700/50 hover:text-white'
              } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
