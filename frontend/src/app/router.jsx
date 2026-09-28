import React from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './auth/LoginPage';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './dashboard/DashboardPage';
import ProductsPage from './products/ProductsPage';
import OrdersPage from './orders/OrdersPage';
import InventoryPage from './inventory/InventoryPage';
import CajaPage from './caja/CajaPage';
import UsersPage from './users/UsersPage';

const router = createHashRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'productos',
        element: <ProductsPage />,
      },
      {
        path: 'comandas',
        element: <OrdersPage />,
      },
      {
        path: 'inventario',
        element: <InventoryPage />,
      },
      {
        path: 'caja',
        element: <CajaPage />,
      },
      {
        path: 'usuarios',
        element: (
          <ProtectedRoute adminOnly>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

export default function AppRouter() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
