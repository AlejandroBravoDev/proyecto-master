import React from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './dashboard/DashboardPage';

const router = createHashRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
