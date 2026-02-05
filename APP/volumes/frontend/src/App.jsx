/**
 * App.jsx
 * React Router v6 - Layout anidado + redirecciones correctas
 */

import React, { useLayoutEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Layout from "@components/layout/Layout";

// Secciones
import Dashboard from "./pages/dashboard/Dashboard";

//Error Page
import ForbiddenPage from "./pages/errorPages/ForbiddenPage";
import NotFoundPage from "./pages/errorPages/NotFoundPage";
import ServerErrorPage from "./pages/errorPages/ServerErrorPage";

// Demos
import General from "./pages/demo/General";
import ModalDemo from "./pages/demo/ModalDemo";

import useBaseSiteStore from "@store/baseSiteStore";

function App() {
  const { theme } = useBaseSiteStore();

  useLayoutEffect(() => {
    const html = document.documentElement;
    const isDark = theme === "dark";
    if (html.classList.contains("dark") !== isDark) {
      html.classList.toggle("dark", isDark);
    }
  }, [theme]);

  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          {/* Redirect base */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Rutas base */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Demos */}
          <Route path="/demo/general" element={<General />} />
          <Route path="/demo/modal" element={<ModalDemo />} />

          {/* Demos: páginas de error (para test/preview UI) */}
          <Route path="/demo/forbidden" element={<ForbiddenPage />} />
          <Route path="/demo/not-found" element={<NotFoundPage />} />
          <Route path="/demo/server-error" element={<ServerErrorPage />} />

          {/* 404 global: cualquier cosa no encontrada */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
