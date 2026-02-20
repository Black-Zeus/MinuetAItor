/**
 * AppRouter.jsx
 * Router principal — MinuetAItor
 *
 * Fix: la ruta "/" se maneja directamente aquí como redirect a /dashboard,
 * sin pasar por ProtectedRoute (que envolvía el Navigate en un Layout
 * e impedía la redirección real).
 */

import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout          from "@/components/layout/Layout";
import ProtectedRoute  from "./guards/ProtectedRoute";
import PublicRoute     from "./guards/PublicRoute";
import { allRoutes }   from "./modules";

import NotFoundPage    from "@/pages/errorPages/NotFoundPage";
import ServerErrorPage from "@/pages/errorPages/ServerErrorPage";
import ForbiddenPage   from "@/pages/errorPages/ForbiddenPage";

// ─── Fallbacks ────────────────────────────────────────────────────────────────

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Cargando...</p>
    </div>
  </div>
);

const InnerLoader = () => (
  <div className="min-h-[400px] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

// ─── AppRouter ────────────────────────────────────────────────────────────────

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Redirect raíz: / → /dashboard ─────────────────────────────────
            Va FUERA del sistema de módulos para que sea un redirect real,
            no un componente renderizado dentro del Layout.             */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* ── Rutas de módulos (dinámicas) ───────────────────────────────── */}
        {allRoutes.map(({ path, component: Component, isPublic, roles }) => {
          const element = (
            <Suspense fallback={isPublic ? <PageLoader /> : <InnerLoader />}>
              <Component />
            </Suspense>
          );

          if (isPublic) {
            return (
              <Route
                key={path}
                path={path}
                element={<PublicRoute>{element}</PublicRoute>}
              />
            );
          }

          return (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute requiredRoles={roles ?? []}>
                  <Layout>
                    <Suspense fallback={<InnerLoader />}>
                      <Component />
                    </Suspense>
                  </Layout>
                </ProtectedRoute>
              }
            />
          );
        })}

        {/* ── Páginas de error ──────────────────────────────────────────── */}
        <Route path="/forbidden"    element={<ForbiddenPage />} />
        <Route path="/server-error" element={<ServerErrorPage />} />

        {/* ── 404 — siempre al final ────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />

      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;