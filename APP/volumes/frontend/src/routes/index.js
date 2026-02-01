// routing/index.js - Setup principal del sistema de rutas
// Export centralizado de todo el sistema

// Componentes principales
export { default as AppRouter } from './AppRouter';
export { default as LazyWrapper } from './LazyWrapper';

// Guards
export { default as ProtectedRoute } from './guards/ProtectedRoute';
export { default as PublicRoute } from './guards/PublicRoute';

// Rutas y módulos
export { allRoutes, authRoutes, dashboardRoutes, demoRoutes } from './modules';

// Hook personalizado (para uso futuro)
export { default as useAppRouter } from '../hooks/useAppRouter';

// Export por defecto - lo más usado
export default {
    AppRouter: () => import('./AppRouter'),
    routes: () => import('./modules'),
    guards: {
        ProtectedRoute: () => import('./guards/ProtectedRoute'),
        PublicRoute: () => import('./guards/PublicRoute')
    }
};