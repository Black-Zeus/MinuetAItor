/**
 * analytics.routes.jsx
 * Rutas del módulo Analytics + Reports
 * Todas apuntan a UnderConstructionPage hasta que estén implementadas
 */
import { lazy } from "react";

const UnderConstruction = lazy(() =>
  import("@/pages/errorPages/UnderConstructionPage")
);

// ─── Analytics ────────────────────────────────────────────────────
const analyticsRoutes = [
  { path: "/analytics/metrics",          title: "Métricas" },
  { path: "/analytics/audit/overview",   title: "Auditoría - Resumen" },
  { path: "/analytics/audit/access",     title: "Auditoría - Accesos" },
  { path: "/analytics/audit/changes",    title: "Auditoría - Cambios" },
  { path: "/analytics/audit/sessions",   title: "Auditoría - Sesiones" },
  { path: "/analytics/audit/exceptions", title: "Auditoría - Excepciones" },
].map((r) => ({ ...r, component: UnderConstruction, requiresAuth: true, roles: [] }));

// ─── Reports ──────────────────────────────────────────────────────
const reportsRoutes = [
  { path: "/reports/projects", title: "Reporte Proyectos" },
  { path: "/reports/minutes",  title: "Reporte Actas" },
  { path: "/reports/actions",  title: "Reporte Acciones" },
  { path: "/reports/kpis",     title: "KPIs" },
  { path: "/reports/export",   title: "Exportación" },
].map((r) => ({ ...r, component: UnderConstruction, requiresAuth: true, roles: [] }));

export { analyticsRoutes, reportsRoutes };
export default [...analyticsRoutes, ...reportsRoutes];