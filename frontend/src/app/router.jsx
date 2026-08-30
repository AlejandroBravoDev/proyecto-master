import React from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './dashboard/DashboardPage';
import InventoryPage from './inventory/InventoryPage';
import ProductsPage from './products/ProductsPage';

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
        path: 'inventario',
        element: <InventoryPage />,
      },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
