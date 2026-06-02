/**
 * knowledge.routes.jsx
 * Rutas del modulo Consulta contextual
 */
import { lazy } from "react";

const KnowledgeSearchPage = lazy(() => import("@/pages/knowledgeSearch/KnowledgeSearchPage"));

export const knowledgeRoutes = [
  {
    path: "/knowledge-search",
    component: KnowledgeSearchPage,
    title: "Consulta contextual",
    requiresAuth: true,
    roles: [],
    permissions: [],
  },
];

export default knowledgeRoutes;
