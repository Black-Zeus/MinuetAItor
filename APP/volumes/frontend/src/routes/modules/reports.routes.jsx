import { lazy } from 'react';

// Reportes Operativos
const DailySalesReportPage = lazy(() => import('@/pages/reports/operational/DailySalesReport'));
const SalesBySellerReportPage = lazy(() => import('@/pages/reports/operational/SalesBySellerReport'));
const TopSellingProductsReportPage = lazy(() => import('@/pages/reports/operational/TopSellingProductsReport'));
const LowStockReportPage = lazy(() => import('@/pages/reports/operational/LowStockReport'));
const InventoryMovementsReportPage = lazy(() => import('@/pages/reports/operational/InventoryMovementsReport'));
const FrequentCustomersReportPage = lazy(() => import('@/pages/reports/operational/FrequentCustomersReport'));
const ReturnedProductsReportPage = lazy(() => import('@/pages/reports/operational/ReturnedProductsReport'));
const BranchPerformanceReportPage = lazy(() => import('@/pages/reports/operational/BranchPerformanceReport'));
const ExpiryAlertsReportPage = lazy(() => import('@/pages/reports/operational/ExpiryAlertsReport'));
const UserActivityReportPage = lazy(() => import('@/pages/reports/operational/UserActivityReport'));

// Reportes Financieros
const IncomeStatementReportPage = lazy(() => import('@/pages/reports/financial/IncomeStatementReport'));
const CashFlowReportPage = lazy(() => import('@/pages/reports/financial/CashFlowReport'));
const AccountsReceivableReportPage = lazy(() => import('@/pages/reports/financial/AccountsReceivableReport'));
const AccountsPayableReportPage = lazy(() => import('@/pages/reports/financial/AccountsPayableReport'));
const ProfitabilityAnalysisReportPage = lazy(() => import('@/pages/reports/financial/ProfitabilityAnalysisReport'));
const BudgetVsActualReportPage = lazy(() => import('@/pages/reports/financial/BudgetVsActualReport'));
const OperationalCostsReportPage = lazy(() => import('@/pages/reports/financial/OperationalCostsReport'));
const ProfitMarginsReportPage = lazy(() => import('@/pages/reports/financial/ProfitMarginsReport'));
const TaxesReportPage = lazy(() => import('@/pages/reports/financial/TaxesReport'));
const FinancialAuditReportPage = lazy(() => import('@/pages/reports/financial/FinancialAuditReport'));

export const reportsRoutes = [
    // Reportes Operativos
    {
        path: '/reports/daily-sales',
        component: DailySalesReportPage,
        title: 'Ventas Diarias',
        requiresAuth: true
    },
    {
        path: '/reports/sales-by-seller',
        component: SalesBySellerReportPage,
        title: 'Ventas por Vendedor',
        requiresAuth: true
    },
    {
        path: '/reports/top-selling-products',
        component: TopSellingProductsReportPage,
        title: 'Productos Más Vendidos',
        requiresAuth: true
    },
    {
        path: '/reports/low-stock',
        component: LowStockReportPage,
        title: 'Inventario Bajo Stock',
        requiresAuth: true
    },
    {
        path: '/reports/inventory-movements',
        component: InventoryMovementsReportPage,
        title: 'Movimientos de Inventario',
        requiresAuth: true
    },
    {
        path: '/reports/frequent-customers',
        component: FrequentCustomersReportPage,
        title: 'Clientes Frecuentes',
        requiresAuth: true
    },
    {
        path: '/reports/returned-products',
        component: ReturnedProductsReportPage,
        title: 'Productos Devueltos',
        requiresAuth: true
    },
    {
        path: '/reports/branch-performance',
        component: BranchPerformanceReportPage,
        title: 'Performance por Sucursal',
        requiresAuth: true
    },
    {
        path: '/reports/expiry-alerts',
        component: ExpiryAlertsReportPage,
        title: 'Alertas de Vencimiento',
        requiresAuth: true
    },
    {
        path: '/reports/user-activity',
        component: UserActivityReportPage,
        title: 'Actividad de Usuarios',
        requiresAuth: true
    },

    // Reportes Financieros
    {
        path: '/reports/financial/income-statement',
        component: IncomeStatementReportPage,
        title: 'Estado de Resultados',
        requiresAuth: true,
        requiredRoles: ['admin', 'supervisor', 'contador']
    },
    {
        path: '/reports/financial/cash-flow',
        component: CashFlowReportPage,
        title: 'Flujo de Caja',
        requiresAuth: true,
        requiredRoles: ['admin', 'supervisor', 'contador']
    },
    {
        path: '/reports/financial/accounts-receivable',
        component: AccountsReceivableReportPage,
        title: 'Cuentas por Cobrar',
        requiresAuth: true,
        requiredRoles: ['admin', 'supervisor', 'contador']
    },
    {
        path: '/reports/financial/accounts-payable',
        component: AccountsPayableReportPage,
        title: 'Cuentas por Pagar',
        requiresAuth: true,
        requiredRoles: ['admin', 'supervisor', 'contador']
    },
    {
        path: '/reports/financial/profitability-analysis',
        component: ProfitabilityAnalysisReportPage,
        title: 'Análisis de Rentabilidad',
        requiresAuth: true,
        requiredRoles: ['admin', 'supervisor', 'contador']
    },
    {
        path: '/reports/financial/budget-vs-actual',
        component: BudgetVsActualReportPage,
        title: 'Presupuesto vs Real',
        requiresAuth: true,
        requiredRoles: ['admin', 'supervisor', 'contador']
    },
    {
        path: '/reports/financial/operational-costs',
        component: OperationalCostsReportPage,
        title: 'Costos Operacionales',
        requiresAuth: true,
        requiredRoles: ['admin', 'supervisor', 'contador']
    },
    {
        path: '/reports/financial/profit-margins',
        component: ProfitMarginsReportPage,
        title: 'Márgenes de Utilidad',
        requiresAuth: true,
        requiredRoles: ['admin', 'supervisor', 'contador']
    },
    {
        path: '/reports/financial/taxes',
        component: TaxesReportPage,
        title: 'Impuestos y Declaraciones',
        requiresAuth: true,
        requiredRoles: ['admin', 'contador']
    },
    {
        path: '/reports/financial/financial-audit',
        component: FinancialAuditReportPage,
        title: 'Auditoría Financiera',
        requiresAuth: true,
        requiredRoles: ['admin', 'contador']
    }
];

export default reportsRoutes;