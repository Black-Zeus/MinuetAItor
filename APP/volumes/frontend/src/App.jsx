/**
 * App.jsx
 * React Router v6 - Layout anidado + redirecciones correctas
 */

import React, { useLayoutEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Layout from "@components/layout/Layout";

// Secciones
import Dashboard from "./pages/dashboard/Dashboard";
import Minute from "./pages/minutes/Minute";
import Client from "./pages/clientes/Client";
import Project from "./pages/project/Project";
import Teams from "./pages/teams/Teams";

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
          {/* Base */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Core */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/minutes" element={<Minute />} />

          {/* Management */}
          <Route path="/clients" element={<Client />} />
          <Route path="/projects" element={<Project />} />
          <Route path="/teams" element={<Teams />} /> 

          {/* Intelligence */}
          <Route path="/metrics" element={<Dashboard />} /> {/* placeholder */}
          <Route path="/reports" element={<Dashboard />} /> {/* placeholder */}

          {/* Config */}
          <Route path="/tags" element={<Dashboard />} /> {/* placeholder */}
          <Route path="/settings/system" element={<Dashboard />} /> {/* placeholder */}

          {/* Demos */}
          <Route path="/demo/general" element={<General />} />
          <Route path="/demo/modal" element={<ModalDemo />} />

          {/* Demos: error pages */}
          <Route path="/demo/forbidden" element={<ForbiddenPage />} />
          <Route path="/demo/not-found" element={<NotFoundPage />} />
          <Route path="/demo/server-error" element={<ServerErrorPage />} />

          {/* 404 global */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
