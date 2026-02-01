
import { lazy } from 'react';

const CashOpeningPage = lazy(() => import('@/pages/cash/CashOpening'));
const CashCountPage = lazy(() => import('@/pages/cash/CashCount'));
const CashMovementsPage = lazy(() => import('@/pages/cash/CashMovements'));
const ExpensesPage = lazy(() => import('@/pages/finance/Expenses'));
const AdditionalIncomePage = lazy(() => import('@/pages/finance/AdditionalIncome'));
const SupplierPaymentsPage = lazy(() => import('@/pages/finance/SupplierPayments'));
const BankReconciliationPage = lazy(() => import('@/pages/finance/BankReconciliation'));

const CashPetty = lazy(() => import('@/pages/cash/CashPetty'));
const CashPos = lazy(() => import('@/pages/cash/CashPos'));

export const cashRoutes = [
    // Modulos Caja
    {
        path: '/cash/petty',
        component: CashPetty,
        title: 'Gastos Menores',
        requiresAuth: true
    },
    {
        path: '/cash/pos',
        component: CashPos,
        title: 'Cobro en Caja',
        requiresAuth: true
    },

    // Operaciones de caja
    {
        path: '/cash/opening',
        component: CashOpeningPage,
        title: 'Apertura de Caja',
        requiresAuth: true
    },
    {
        path: '/cash/count',
        component: CashCountPage,
        title: 'Arqueo de Caja',
        requiresAuth: true
    },
    {
        path: '/cash/movements',
        component: CashMovementsPage,
        title: 'Movimientos de Caja',
        requiresAuth: true
    },

    // Transacciones financieras
    {
        path: '/finance/expenses',
        component: ExpensesPage,
        title: 'Gastos Operativos',
        requiresAuth: true
    },
    {
        path: '/finance/additional-income',
        component: AdditionalIncomePage,
        title: 'Ingresos Adicionales',
        requiresAuth: true
    },
    {
        path: '/finance/supplier-payments',
        component: SupplierPaymentsPage,
        title: 'Pagos a Proveedores',
        requiresAuth: true
    },
    {
        path: '/finance/bank-reconciliation',
        component: BankReconciliationPage,
        title: 'Conciliación Bancaria',
        requiresAuth: true
    }
];

export default cashRoutes;