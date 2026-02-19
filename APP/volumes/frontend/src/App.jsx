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
import Tags from "./pages/tags/Tags";

//Error Page
import ForbiddenPage from "./pages/errorPages/ForbiddenPage";
import NotFoundPage from "./pages/errorPages/NotFoundPage";
import ServerErrorPage from "./pages/errorPages/ServerErrorPage";

// Demos
import General from "./pages/demo/General";
import ModalDemo from "./pages/demo/ModalDemo";

import useBaseSiteStore from "@store/baseSiteStore";
import ProfilesCatalog from "./pages/profiles/ProfilesCatalog";
import MinuteEditor from "./pages/minuteEditor/MinuteEditor";
import UserProfile from "./pages/userProfile/UserProfile";
import UnderConstructionPage from "./pages/errorPages/UnderConstructionPage";
import GlobalSearch from "./pages/globalSearch/GlobalSearch";

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
          <Route path="/globalSearch" element={<GlobalSearch />} />



          <Route path="/minutes" element={<Minute />} />
          <Route path="/minutes/process/:id" element={<MinuteEditor />} />

          {/* Management */}
          <Route path="/clients" element={<Client />} />
          <Route path="/projects" element={<Project />} />
          <Route path="/teams" element={<Teams />} /> 

          {/* Intelligence */}
          <Route path="/analytics/metrics" element={<UnderConstructionPage />} /> {/* placeholder */}
          <Route path="/analytics/audit/overview" element={<UnderConstructionPage />} /> {/* placeholder */}
          <Route path="/analytics/audit/access" element={<UnderConstructionPage />} /> {/* placeholder */}
          <Route path="/analytics/audit/changes" element={<UnderConstructionPage />} /> {/* placeholder */}
          <Route path="/analytics/audit/sessions" element={<UnderConstructionPage />} /> {/* placeholder */}
          <Route path="/analytics/audit/exceptions" element={<UnderConstructionPage />} /> {/* placeholder */}

          <Route path="/reports/projects" element={<UnderConstructionPage />} /> {/* placeholder */}
          <Route path="/reports/minutes" element={<UnderConstructionPage />} /> {/* placeholder */}
          <Route path="/reports/actions" element={<UnderConstructionPage />} /> {/* placeholder */}
          <Route path="/reports/kpis" element={<UnderConstructionPage />} /> {/* placeholder */}
          <Route path="/reports/export" element={<UnderConstructionPage />} /> {/* placeholder */}

          {/* Config */}
          <Route path="/settings/tags" element={<Tags />} /> {/* placeholder */}
          <Route path="/settings/profiles" element={<ProfilesCatalog />} /> {/* placeholder */}
          <Route path="/settings/userProfile" element={<UserProfile />} />

          <Route path="/settings/system" element={<UnderConstructionPage />} /> {/* placeholder */}

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
