import { lazy } from 'react';

const DashboardPage = lazy(() => import('@/pages/dashboard/Dashboard'));

export const dashboardRoutes = [
    {
        path: '/',
        component: DashboardPage,
        title: 'Dashboard',
        requiresAuth: true
    },
    {
        path: '/dashboard',
        component: DashboardPage,
        title: 'Dashboard',
        requiresAuth: true
    }
];

export default dashboardRoutes;