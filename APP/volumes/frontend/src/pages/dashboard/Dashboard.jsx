/**
 * Dashboard.jsx
 * Renderiza condicionalmente cada sección según baseSiteStore → dashboard.widgets.enabled
 */

import React, { useEffect, useState, useMemo } from "react";
import { FaCalendarAlt, FaFileAlt, FaUsers } from "react-icons/fa";

import dashboardData from "@/data/dataDashBoard.json";
import minutesData   from "@/data/minutes.json";
import clientsData   from "@/data/dataClientes.json";
import projectsData  from "@/data/dataProjectos.json";

import DashboardHeader   from "./DashboardHeader";
import MetricCard        from "./MetricCard";
import PopularTags       from "./PopularTags";
import LastConectionInfo from "./LastConectionInfo";
import MinutesSection    from "./MinutesSection";
import ConfidentialSection from "./ConfidentialSection";
import PageLoadingSpinner  from "@/components/ui/modal/types/system/PageLoadingSpinner";

import useBaseSiteStore from "@store/baseSiteStore"; // ← FIX: era dashboardStore

import logger from '@/utils/logger';
const dashboardLog = logger.scope("dashboard");

export const TXT_TITLE    = "text-gray-900 dark:text-white";
export const TXT_SUBTITLE = "text-gray-700 dark:text-gray-200";
export const TXT_BODY     = "text-gray-600 dark:text-gray-300";
export const TXT_META     = "text-gray-500 dark:text-gray-400";

const randomN = (arr, n) => {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
};

const Dashboard = () => {
  // FIX: widgets viven en baseSiteStore.dashboard.widgets (no en dashboardStore)
  const widgets = useBaseSiteStore((s) => s.dashboard?.widgets ?? {});
  const w       = (key) => widgets[key]?.enabled ?? true;

  const [isLoading, setIsLoading] = useState(true);
  const [hasError,  setHasError]  = useState(false);
  const [tagsData,  setTagsData]  = useState([]);

  const [pendingMinutes,       setPendingMinutes]       = useState([]);
  const [participatedMinutes,  setParticipatedMinutes]  = useState([]);
  const [confidentialClients,  setConfidentialClients]  = useState([]);
  const [confidentialProjects, setConfidentialProjects] = useState([]);

  const allClients = useMemo(() => clientsData?.clients || [], []);

  const [userName] = useState("John Doe");

  useEffect(() => {
    const load = async () => {
      try {
        await new Promise((r) => setTimeout(r, 450));

        setTagsData(dashboardData?.tagsPopular ?? []);

        const allMinutes = Array.isArray(minutesData?.minutes) ? minutesData.minutes : [];
        setPendingMinutes(allMinutes.filter((m) => m.status === "pending"));
        setParticipatedMinutes(randomN(allMinutes, 5));

        setConfidentialClients(
          randomN((clientsData?.clients || []).filter((c) => c.isconfidential === true), 5)
        );
        setConfidentialProjects(
          randomN((projectsData?.projects || []).filter((p) => p.isconfidential === true), 5)
        );
      } catch (err) {
        dashboardLog.error("[Dashboard] Error loading data:", err);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleUpdateClient  = (u) => setConfidentialClients((p)  => p.map((c) => c.id === u.id ? u : c));
  const handleDeleteClient  = (id) => setConfidentialClients((p)  => p.filter((c) => c.id !== id));
  const handleEditProject   = (u) => setConfidentialProjects((p) => p.map((c) => c.id === u.id ? u : c));
  const handleDeleteProject = (id) => setConfidentialProjects((p) => p.filter((c) => c.id !== id));

  if (isLoading) return <PageLoadingSpinner message="Cargando dashboard..." />;
  if (hasError)  return <div>Error al cargar los datos del dashboard.</div>;

  return (
    <div className="space-y-6 p-6 bg-background-light dark:bg-background-dark transition-theme min-h-screen">

      <DashboardHeader
        userName={userName}
        subtitle="Resumen de tu actividad en MinuetAItor"
      />

      {w("stats") && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            icon={FaCalendarAlt}
            title="Minutas este mes"
            value={dashboardData?.metrics?.totalMinutes?.value ?? 0}
            change={dashboardData?.metrics?.totalMinutes?.change ?? 0}
            isNew={false}
            variant="primary"
          />
          <MetricCard
            icon={FaFileAlt}
            title="Proyectos activos"
            value={dashboardData?.metrics?.activeProjects?.value ?? 0}
            change={dashboardData?.metrics?.activeProjects?.change ?? 0}
            isNew={false}
            variant="warm"
          />
          <MetricCard
            icon={FaUsers}
            title="Clientes activos"
            value={dashboardData?.metrics?.totalClients?.value ?? 0}
            change={Math.abs(dashboardData?.metrics?.totalClients?.change ?? 0)}
            isNew={false}
            variant="info"
          />
        </div>
      )}

      {w("ultima_conexion") && <LastConectionInfo />}

      {w("minutas_pendientes") && (
        <MinutesSection
          title="Minutas pendientes de aprobación"
          description="Minutas en estado pendiente que requieren revisión o aprobación."
          titleIcon="FaClipboardCheck"
          actionLabel="Ver todas"
          actionIcon="FaList"
          onAction={() => dashboardLog.log("[Dashboard] Ver minutas pendientes")}
          minutes={pendingMinutes}
          emptyMessage="No hay minutas pendientes de aprobación."
        />
      )}

      {w("minutas_participadas") && (
        <MinutesSection
          title="Minutas donde participé"
          description="Últimas minutas registradas con tu participación."
          titleIcon="FaUserCheck"
          actionLabel="Historial"
          actionIcon="history"
          onAction={() => dashboardLog.log("[Dashboard] Ver historial de participación")}
          minutes={participatedMinutes}
          emptyMessage="No hay minutas registradas con tu participación."
        />
      )}

      {w("clientes_confidenciales") && (
        <ConfidentialSection
          type="clients"
          title="Clientes confidenciales con acceso"
          description="Clientes marcados como confidenciales a los cuales tu usuario tiene visibilidad."
          titleIcon="FaUserShield"
          actionLabel="Administrar accesos"
          actionIcon="FaKey"
          onAction={() => dashboardLog.log("[Dashboard] Administrar accesos")}
          items={confidentialClients}
          emptyMessage="No tienes acceso a clientes confidenciales."
          onUpdate={handleUpdateClient}
          onDelete={handleDeleteClient}
        />
      )}

      {w("proyectos_confidenciales") && (
        <ConfidentialSection
          type="projects"
          title="Proyectos confidenciales con acceso"
          description="Proyectos confidenciales donde tu usuario tiene permisos."
          titleIcon="FaFolderClosed"
          actionLabel="Ver proyectos"
          actionIcon="folder"
          onAction={() => dashboardLog.log("[Dashboard] Ver proyectos confidenciales")}
          items={confidentialProjects}
          emptyMessage="No tienes acceso a proyectos confidenciales."
          clients={allClients}
          onEdit={handleEditProject}
          onDelete={handleDeleteProject}
        />
      )}

      {w("tags_populares") && <PopularTags tags={tagsData} />}

    </div>
  );
};

export default Dashboard;