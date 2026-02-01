/**
 * AppRouter.jsx - Router principal simplificado
 * Usa tu Layout existente solo para rutas privadas
 */

import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Tu Layout existente
import Layout from "@/components/layout";

// Guards
import ProtectedRoute from "./guards/ProtectedRoute";
import PublicRoute from "./guards/PublicRoute";

// Lazy Wrapper
import LazyWrapper from "./LazyWrapper";

// Rutas organizadas
import { allRoutes } from "./modules";

// Páginas de error
import NotFoundPage from "@/pages/errorPages/NotFoundPage";
import ServerErrorPage from "@/pages/errorPages/ServerErrorPage";
import ForbiddenPage from "@/pages/errorPages/ForbiddenPage";

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Mapear todas las rutas */}
        {allRoutes.map((route) => {
          const {
            path,
            component: Component,
            isPublic,
            requiresAuth,
            roles,
            ...routeProps
          } = route;

          // Determinar el elemento base
          let routeElement = (
            <LazyWrapper>
              <Component {...routeProps} />
            </LazyWrapper>
          );

          // Aplicar guards según el tipo de ruta
          if (isPublic) {
            // Rutas públicas (login, etc.) - SIN Layout
            routeElement = <PublicRoute>{routeElement}</PublicRoute>;
          } else {
            // Rutas privadas - CON Layout
            routeElement = (
              <ProtectedRoute requiredRoles={roles}>
                <Layout>{routeElement}</Layout>
              </ProtectedRoute>
            );
          }

          return <Route key={path} path={path} element={routeElement} />;
        })}

        {/* ================================ */}
        {/* RUTAS DE ERROR */}
        {/* ================================ */}
        <Route
          path="/forbidden"
          element={
            <LazyWrapper>
              <ForbiddenPage />
            </LazyWrapper>
          }
        />

        <Route
          path="/server-error"
          element={
            <LazyWrapper>
              <ServerErrorPage />
            </LazyWrapper>
          }
        />

        {/* ================================ */}
        {/* 404 - DEBE IR AL FINAL */}
        {/* ================================ */}
        <Route
          path="*"
          element={
            <LazyWrapper>
              <NotFoundPage />
            </LazyWrapper>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
