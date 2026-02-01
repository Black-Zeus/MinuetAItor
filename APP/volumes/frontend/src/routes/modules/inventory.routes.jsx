import { lazy } from 'react';

const ProductsPage = lazy(() => import('@/pages/inventory/products/Products'));
const CategoriesPage = lazy(() => import('@/pages/inventory/products/Categories'));
const BarcodesPage = lazy(() => import('@/pages/inventory/products/Barcodes'));
const PriceListsPage = lazy(() => import('@/pages/inventory/products/PriceLists'));
const StockMovementsPage = lazy(() => import('@/pages/inventory/stock/StockMovements'));
const PhysicalInventoryPage = lazy(() => import('@/pages/inventory/stock/PhysicalInventory'));
const InventoryAdjustmentsPage = lazy(() => import('@/pages/inventory/stock/InventoryAdjustments'));
const TransfersPage = lazy(() => import('@/pages/inventory/stock/Transfers'));
const SuppliersPage = lazy(() => import('@/pages/inventory/suppliers/Suppliers'));
const SupplierContactsPage = lazy(() => import('@/pages/inventory/suppliers/SupplierContacts'));
const SupplierProductsPage = lazy(() => import('@/pages/inventory/suppliers/SupplierProducts'));
const PurchaseOrdersPage = lazy(() => import('@/pages/inventory/suppliers/PurchaseOrders'));
const SupplierPurchaseHistoryPage = lazy(() => import('@/pages/inventory/suppliers/PurchaseHistory'));
const SupplierEvaluationPage = lazy(() => import('@/pages/inventory/suppliers/SupplierEvaluation'));
const SupplierAccountsPayablePage = lazy(() => import('@/pages/inventory/suppliers/AccountsPayable'));

export const inventoryRoutes = [
    // Gestión de productos
    {
        path: '/products',
        component: ProductsPage,
        title: 'Lista de Productos',
        requiresAuth: true
    },
    {
        path: '/categories',
        component: CategoriesPage,
        title: 'Categorías',
        requiresAuth: true
    },
    {
        path: '/barcodes',
        component: BarcodesPage,
        title: 'Códigos de Barras',
        requiresAuth: true
    },
    {
        path: '/price-lists',
        component: PriceListsPage,
        title: 'Listas de Precios',
        requiresAuth: true
    },

    // Gestión de stock
    {
        path: '/stock/movements',
        component: StockMovementsPage,
        title: 'Movimientos de Stock',
        requiresAuth: true
    },
    {
        path: '/stock/physical',
        component: PhysicalInventoryPage,
        title: 'Inventario Físico',
        requiresAuth: true
    },
    {
        path: '/stock/adjustments',
        component: InventoryAdjustmentsPage,
        title: 'Ajustes de Inventario',
        requiresAuth: true
    },
    {
        path: '/stock/transfers',
        component: TransfersPage,
        title: 'Transferencias',
        requiresAuth: true
    },

    // Gestión de proveedores
    {
        path: '/suppliers',
        component: SuppliersPage,
        title: 'Lista de Proveedores',
        requiresAuth: true
    },
    {
        path: '/suppliers/contacts',
        component: SupplierContactsPage,
        title: 'Contactos y Representantes',
        requiresAuth: true
    },
    {
        path: '/suppliers/purchase-history',
        component: SupplierPurchaseHistoryPage,
        title: 'Historial de Compras',
        requiresAuth: true
    },
    {
        path: '/suppliers/accounts-payable',
        component: SupplierAccountsPayablePage,
        title: 'Cuentas por Pagar',
        requiresAuth: true
    }
];

export default inventoryRoutes;