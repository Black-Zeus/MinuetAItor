// src/routes/modules/demo.routes.jsx
// Configuración de rutas del módulo Demo/Export refactorizado
// Coherente con el nuevo sistema de demos creado desde cero

import { lazy } from "react";

// Lazy loading de componentes nuevos del demo refactorizado
const ExporterDemosIndex = lazy(() => import("@/pages/demos/exporters/Index"));
const DownloadDemo = lazy(() => import("@/pages/demos/exporters/DownloadDemo"));
const AdvancedDemo = lazy(() => import("@/pages/demos/exporters/AdvancedDemo"));
const PerformanceDemo = lazy(() =>
  import("@/pages/demos/exporters/PerformanceDemo")
);
const ModalDemo = lazy(() => import("@/pages/demos/modal/ModalDemo"));

export const demoRoutes = [
  {
    path: "/demos/exporters",
    component: ExporterDemosIndex,
    title: "Demo Módulo Export - Sistema Refactorizado",
    description:
      "Demostración completa del módulo de exportación refactorizado v2.0",
    requiresAuth: false,
    requiredRoles: [],
    meta: {
      module: "export-demo",
      version: "2.0",
      features: ["exportacion", "descarga", "formularios", "performance"],
      breadcrumb: [
        { text: "Inicio", path: "/" },
        { text: "Demos", path: "/demos" },
        { text: "Export", path: "/demos/exporters" },
      ],
    },
  },
  {
    path: "/demos/exporters/download",
    component: DownloadDemo,
    title: "Demo de Descargas - DownloadManager",
    description:
      "Sistema de descargas con múltiples métodos y manejo de errores",
    requiresAuth: false,
    requiredRoles: [],
    meta: {
      module: "download-demo",
      features: ["descarga-nativa", "filesaver", "filesystem-api", "progreso"],
      parent: "/demos/exporters",
    },
  },
  {
    path: "/demos/exporters/advanced",
    component: AdvancedDemo,
    title: "Demo Casos Avanzados - Formularios y Configuración",
    description:
      "Formularios especializados, configuraciones predefinidas y datos complejos",
    requiresAuth: false,
    requiredRoles: [],
    meta: {
      module: "advanced-demo",
      features: ["formularios", "configuracion", "datos-complejos", "presets"],
      parent: "/demos/exporters",
    },
  },
  {
    path: "/demos/exporters/performance",
    component: PerformanceDemo,
    title: "Demo de Rendimiento - Benchmarks y Optimización",
    description:
      "Testing de performance, análisis de memoria y benchmarks completos",
    requiresAuth: false,
    requiredRoles: [],
    meta: {
      module: "performance-demo",
      features: ["benchmarks", "memoria", "escalabilidad", "metricas"],
      parent: "/demos/exporters",
    },
  },
  {
    path: "/demos/modal",
    component: ModalDemo,
    title: "Demo Modales - Gestor Modales",
    description: "Modales administrados internos",
    requiresAuth: false,
    requiredRoles: [],
    meta: {
      module: "modal",
      features: ["modal"],
      parent: "/demos",
    },
  },
];

export default demoRoutes;
