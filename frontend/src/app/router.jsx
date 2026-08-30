import React from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './dashboard/DashboardPage';
import ProductsPage from './products/ProductsPage';
import OrdersPage from './orders/OrdersPage';
import InventoryPage from './inventory/InventoryPage';
import CajaPage from './caja/CajaPage';

const router = createHashRouter([
  {
    path: '/',
    element: <MainLayout />,
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
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
