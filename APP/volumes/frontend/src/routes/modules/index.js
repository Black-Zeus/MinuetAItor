// modules/index.js - Combina todos los módulos de rutas
// Punto central para todas las rutas del sistema

import { authRoutes } from './auth.routes';
import { dashboardRoutes } from './dashboard.routes';
import { adminRoutes } from './admin.routes';
import { salesRoutes } from './sales.routes';
import { cashRoutes } from './cash.routes';
import { inventoryRoutes } from './inventory.routes';
import { reportsRoutes } from './reports.routes';
import { configRoutes } from './config.routes';
import { demoRoutes } from './demo.routes';
import profileRoutes from "./profile";

// Combinar todas las rutas en orden de prioridad
export const allRoutes = [
    ...authRoutes,
    ...dashboardRoutes,
    ...profileRoutes,
    ...adminRoutes,
    ...salesRoutes,
    ...cashRoutes,
    ...inventoryRoutes,
    ...reportsRoutes,
    ...configRoutes,
    ...demoRoutes
];

// Export individual de módulos (para uso específico)
export { authRoutes } from './auth.routes';
export { dashboardRoutes } from './dashboard.routes';
export { adminRoutes } from './admin.routes';
export { salesRoutes } from './sales.routes';
export { cashRoutes } from './cash.routes';
export { inventoryRoutes } from './inventory.routes';
export { reportsRoutes } from './reports.routes';
export { configRoutes } from './config.routes';
export { demoRoutes } from './demo.routes';

export default allRoutes;