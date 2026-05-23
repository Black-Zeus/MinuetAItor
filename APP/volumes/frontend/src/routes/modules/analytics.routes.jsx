/**
 * analytics.routes.jsx
 * Rutas del módulo Analytics + Reports
 * Todas las rutas de reportes apuntan a UnderConstructionPage hasta que estén implementadas
 */
import { lazy } from "react";

import {
  AUDIT_REPORT_ITEMS,
  GESTION_REPORT_ITEMS,
} from "@config/sidebarConfig";

const MetricsPage = lazy(() =>
  import("@/pages/analytics/MetricsPage")
);

const ReportsCatalogPage = lazy(() =>
  import("@/pages/analytics/ReportsCatalogPage")
);

const UnderConstruction = lazy(() =>
  import("@/pages/errorPages/UnderConstructionPage")
);

const buildPlaceholderRoutes = (items = [], prefix) =>
  items.map((item) => ({
    path: item.path,
    title: `${prefix} - ${item.name}`,
    component: UnderConstruction,
    requiresAuth: true,
    roles: [],
  }));

// ─── Analytics ────────────────────────────────────────────────────
const analyticsRoutes = [
  {
    path: "/analytics/metrics",
    title: "Métricas",
    component: MetricsPage,
    requiresAuth: true,
    roles: [],
  },
];

// ─── Reports ──────────────────────────────────────────────────────
const reportIndexRoutes = [
  {
    path: "/reports/gestion",
    title: "Reportería de Gestión",
    component: ReportsCatalogPage,
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/reports/auditoria",
    title: "Reportería de Auditoría",
    component: ReportsCatalogPage,
    requiresAuth: true,
    roles: [],
  },
];

const gestionReportsRoutes = buildPlaceholderRoutes(GESTION_REPORT_ITEMS, "Reportes Gestión");
const auditReportsRoutes = buildPlaceholderRoutes(AUDIT_REPORT_ITEMS, "Reportes Auditoría");
const reportsRoutes = [...reportIndexRoutes, ...gestionReportsRoutes, ...auditReportsRoutes];

export { analyticsRoutes, reportsRoutes };
export default [...analyticsRoutes, ...reportsRoutes];
