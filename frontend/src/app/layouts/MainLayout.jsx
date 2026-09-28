import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-brand-bg text-brand-text font-['Istok_Web']">
      {/* Global Fixed Sidebar */}
      <Sidebar />

      {/* Main Scrollable Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto h-full">
        <Outlet />
      </main>
    </div>
  );
}
