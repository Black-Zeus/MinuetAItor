/**
 * App.jsx
 * React Router v6 - Layout anidado + redirecciones correctas
 */

import React, { useLayoutEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Layout from "@components/layout/Layout";

// Core
import Dashboard from "./pages/dashboard/Dashboard";
import GlobalSearch from "./pages/globalSearch/GlobalSearch";

// Minutes
import Minute from "./pages/minutes/Minute";
import MinuteEditor from "./pages/minuteEditor/MinuteEditor";

// Management
import Client from "./pages/clientes/Client";
import Project from "./pages/project/Project";
import Teams from "./pages/teams/Teams";

// Analytics & Reports
import UnderConstructionPage from "./pages/errorPages/UnderConstructionPage";

// Settings
import Tags from "./pages/tags/Tags";
import ProfilesCatalog from "./pages/profiles/ProfilesCatalog";
import UserProfile from "./pages/userProfile/UserProfile";

// Error Pages
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

          {/* ── Redirect ─────────────────────────────────────────── */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* ── Core ─────────────────────────────────────────────── */}
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/globalSearch" element={<GlobalSearch />} />

          {/* ── Minutes ──────────────────────────────────────────── */}
          <Route path="/minutes"              element={<Minute />} />
          <Route path="/minutes/process/:id"  element={<MinuteEditor />} />

          {/* ── Management ───────────────────────────────────────── */}
          <Route path="/clients"  element={<Client />} />
          <Route path="/projects" element={<Project />} />
          <Route path="/teams"    element={<Teams />} />

          {/* ── Analytics ────────────────────────────────────────── */}
          <Route path="/analytics/metrics"          element={<UnderConstructionPage />} />
          <Route path="/analytics/audit/overview"   element={<UnderConstructionPage />} />
          <Route path="/analytics/audit/access"     element={<UnderConstructionPage />} />
          <Route path="/analytics/audit/changes"    element={<UnderConstructionPage />} />
          <Route path="/analytics/audit/sessions"   element={<UnderConstructionPage />} />
          <Route path="/analytics/audit/exceptions" element={<UnderConstructionPage />} />

          {/* ── Reports ──────────────────────────────────────────── */}
          <Route path="/reports/projects" element={<UnderConstructionPage />} />
          <Route path="/reports/minutes"  element={<UnderConstructionPage />} />
          <Route path="/reports/actions"  element={<UnderConstructionPage />} />
          <Route path="/reports/kpis"     element={<UnderConstructionPage />} />
          <Route path="/reports/export"   element={<UnderConstructionPage />} />

          {/* ── Settings ─────────────────────────────────────────── */}
          <Route path="/settings/tags"         element={<Tags />} />
          <Route path="/settings/profiles"     element={<ProfilesCatalog />} />
          <Route path="/settings/userProfile"  element={<UserProfile />} />
          <Route path="/settings/system"       element={<UnderConstructionPage />} />

          {/* ── Help ─────────────────────────────────────────────── */}
          <Route path="/help" element={<UnderConstructionPage />} />

          {/* ── Demos ────────────────────────────────────────────── */}
          <Route path="/demo/general"      element={<General />} />
          <Route path="/demo/modal"        element={<ModalDemo />} />
          <Route path="/demo/forbidden"    element={<ForbiddenPage />} />
          <Route path="/demo/not-found"    element={<NotFoundPage />} />
          <Route path="/demo/server-error" element={<ServerErrorPage />} />

          {/* ── 404 ──────────────────────────────────────────────── */}
          <Route path="*" element={<NotFoundPage />} />

        </Route>
      </Routes>
    </Router>
  );
}

export default App;