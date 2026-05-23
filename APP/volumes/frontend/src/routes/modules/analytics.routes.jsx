/**
 * analytics.routes.jsx
 * Rutas del módulo Analytics + Reports
 * Los reportes no implementados siguen apuntando a UnderConstructionPage
 */
import { lazy } from "react";

import {
  AUDIT_REPORT_ITEMS,
  GESTION_REPORT_ITEMS,
} from "@config/sidebarConfig";
import { isActiveGestionReport } from "@/pages/analytics/reports/activeGestionReports";

const MetricsPage = lazy(() =>
  import("@/pages/analytics/MetricsPage")
);

const ReportsCatalogPage = lazy(() =>
  import("@/pages/analytics/ReportsCatalogPage")
);

const ManagementOperationalReportPage = lazy(() =>
  import("@/pages/analytics/ManagementOperationalReportPage")
);

const ManagementAiUsageReportPage = lazy(() =>
  import("@/pages/analytics/ManagementAiUsageReportPage")
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

const AI_ACTIVE_REPORT_IDS = new Set([
  "gestion-ai-usage",
  "gestion-ai-cost-client",
  "gestion-ai-cost-project",
  "gestion-ai-cost-model",
  "gestion-ai-cost-provider",
  "gestion-ai-latency-model",
  "gestion-ai-profile-usage",
  "gestion-ai-errors",
]);

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
    path: "/reports/management",
    title: "Reportería de Gestión",
    component: ReportsCatalogPage,
    requiresAuth: true,
    roles: [],
  },
  {
    path: "/reports/audit",
    title: "Reportería de Auditoría",
    component: ReportsCatalogPage,
    requiresAuth: true,
    roles: [],
  },
];

const gestionReportsRoutes = buildPlaceholderRoutes(
  GESTION_REPORT_ITEMS.filter((item) => !isActiveGestionReport(item.id)),
  "Reportes Gestión"
);
const gestionActiveRoutes = GESTION_REPORT_ITEMS.filter((item) =>
  isActiveGestionReport(item.id)
).map((item) => ({
  path: item.path,
  title: item.name,
  component: AI_ACTIVE_REPORT_IDS.has(item.id)
    ? ManagementAiUsageReportPage
    : ManagementOperationalReportPage,
  requiresAuth: true,
  roles: [],
}));
const auditReportsRoutes = buildPlaceholderRoutes(AUDIT_REPORT_ITEMS, "Reportes Auditoría");
const reportsRoutes = [
  ...reportIndexRoutes,
  ...gestionActiveRoutes,
  ...gestionReportsRoutes,
  ...auditReportsRoutes,
];

export { analyticsRoutes, reportsRoutes };
export default [...analyticsRoutes, ...reportsRoutes];
