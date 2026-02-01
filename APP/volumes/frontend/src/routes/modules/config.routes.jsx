import { lazy } from 'react';

const SystemParametersPage = lazy(() => import('@/pages/config/SystemParameters'));
const CompanyConfigPage = lazy(() => import('@/pages/config/CompanyConfig'));
const TaxConfigPage = lazy(() => import('@/pages/config/TaxConfig'));
const PaymentMethodsPage = lazy(() => import('@/pages/config/PaymentMethods'));
const DocumentTemplatesPage = lazy(() => import('@/pages/config/DocumentTemplates'));
const BackupPage = lazy(() => import('@/pages/config/Backup'));
const SystemLogsPage = lazy(() => import('@/pages/config/SystemLogs'));
const SystemAuditPage = lazy(() => import('@/pages/config/SystemAudit'));
const DatabaseOptimizationPage = lazy(() => import('@/pages/config/DatabaseOptimization'));

export const configRoutes = [
    // Configuración General
    {
        path: '/config/system-parameters',
        component: SystemParametersPage,
        title: 'Parámetros del Sistema',
        requiresAuth: true,
        requiredRoles: ['admin']
    },
    {
        path: '/config/company',
        component: CompanyConfigPage,
        title: 'Configuración de Empresa',
        requiresAuth: true,
        requiredRoles: ['admin', 'supervisor']
    },
    {
        path: '/config/taxes',
        component: TaxConfigPage,
        title: 'Configuración de Impuestos',
        requiresAuth: true,
        requiredRoles: ['admin', 'contador']
    },
    {
        path: '/config/payment-methods',
        component: PaymentMethodsPage,
        title: 'Métodos de Pago',
        requiresAuth: true,
        requiredRoles: ['admin', 'supervisor']
    },
    {
        path: '/config/document-templates',
        component: DocumentTemplatesPage,
        title: 'Plantillas de Documentos',
        requiresAuth: true,
        requiredRoles: ['admin']
    },

    // Mantenimiento del Sistema
    {
        path: '/config/backup',
        component: BackupPage,
        title: 'Backup y Restauración',
        requiresAuth: true,
        requiredRoles: ['admin']
    },
    {
        path: '/config/system-logs',
        component: SystemLogsPage,
        title: 'Logs del Sistema',
        requiresAuth: true,
        requiredRoles: ['admin']
    },
    {
        path: '/config/system-audit',
        component: SystemAuditPage,
        title: 'Auditoría del Sistema',
        requiresAuth: true,
        requiredRoles: ['admin']
    },
    {
        path: '/config/database-optimization',
        component: DatabaseOptimizationPage,
        title: 'Optimización de Base de Datos',
        requiresAuth: true,
        requiredRoles: ['admin']
    }
];

export default configRoutes;