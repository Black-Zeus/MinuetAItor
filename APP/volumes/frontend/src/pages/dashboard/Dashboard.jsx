/**
 * Dashboard.jsx
 * Renderiza condicionalmente cada sección según baseSiteStore → dashboard.widgets.enabled
 */

import React, { useEffect, useState } from "react";
import { FaCalendarAlt, FaFileAlt, FaUsers } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import dashboardData from "@/data/dataDashBoard.json";

import DashboardHeader from "./DashboardHeader";
import MetricCard from "./MetricCard";
import LastConectionInfo from "./LastConectionInfo";
import MinutesSection from "./MinutesSection";
import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";

import useBaseSiteStore from "@store/baseSiteStore"; // ← FIX: era dashboardStore
import useSessionStore, { sessionSelectors } from "@store/sessionStore";
import { listMinutes } from "@/services/minutesService";

import logger from '@/utils/logger';
const dashboardLog = logger.scope("dashboard");

export const TXT_TITLE = "text-gray-900 dark:text-white";
export const TXT_SUBTITLE = "text-gray-700 dark:text-gray-200";
export const TXT_BODY = "text-gray-600 dark:text-gray-300";
export const TXT_META = "text-gray-500 dark:text-gray-400";

const Dashboard = () => {
  const navigate = useNavigate();

  // FIX: widgets viven en baseSiteStore.dashboard.widgets (no en dashboardStore)
  const widgets = useBaseSiteStore((s) => s.dashboard?.widgets ?? {});
  const w = (key) => widgets[key]?.enabled ?? true;
  const sessionUser = useSessionStore(sessionSelectors.user);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [readyMinutes, setReadyMinutes] = useState([]);
  const [pendingMinutes, setPendingMinutes] = useState([]);
  const [participatedMinutes, setParticipatedMinutes] = useState([]);
  const [completedMinutes, setCompletedMinutes] = useState([]);
  const userName = sessionUser?.full_name || sessionUser?.username || "Usuario";

  useEffect(() => {
    const load = async () => {
      try {
        const [readyResult, pendingResult, participantResult, completedResult] = await Promise.all([
          listMinutes({
            limit: 6,
            status_filter: "ready-for-edit",
            mine_as_preparer: true,
          }),
          listMinutes({
            limit: 6,
            status_filter: "pending",
            mine_as_preparer: true,
          }),
          listMinutes({
            limit: 6,
            mine_as_participant: true,
            exclude_mine_as_preparer: true,
          }),
          listMinutes({
            limit: 6,
            status_filter: "completed",
            mine_as_preparer: true,
          }),
        ]);

        setReadyMinutes(Array.isArray(readyResult?.minutes) ? readyResult.minutes : []);
        setPendingMinutes(Array.isArray(pendingResult?.minutes) ? pendingResult.minutes : []);
        setParticipatedMinutes(Array.isArray(participantResult?.minutes) ? participantResult.minutes : []);
        setCompletedMinutes(Array.isArray(completedResult?.minutes) ? completedResult.minutes : []);
      } catch (err) {
        dashboardLog.error("[Dashboard] Error loading data:", err);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) return <PageLoadingSpinner message="Cargando dashboard..." />;
  if (hasError) return <div>Error al cargar los datos del dashboard.</div>;

  return (
    <div className="space-y-6 p-6 bg-background-light dark:bg-background-dark transition-theme min-h-screen">

      <DashboardHeader
        userName={userName}
        subtitle="Resumen de tu actividad en MinuetAItor"
        onNewMinute={() => navigate("/minutes")}
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
          title="Minutas listas para editar"
          description="Minutas donde eres elaborador y están en estado ready-for-edit."
          titleIcon="FaClipboardCheck"
          actionLabel="Ver todas"
          actionIcon="FaList"
          onAction={() => navigate("/minutes")}
          minutes={readyMinutes}
          emptyMessage="No tienes minutas listas para editar."
        />
      )}

      {w("minutas_pendientes") && (
        <MinutesSection
          title="Minutas en edición"
          description="Minutas donde eres elaborador y están en estado pending."
          titleIcon="FaPenToSquare"
          actionLabel="Ver todas"
          actionIcon="FaList"
          onAction={() => navigate("/minutes")}
          minutes={pendingMinutes}
          emptyMessage="No tienes minutas en edición."
        />
      )}

      {w("minutas_participadas") && (
        <MinutesSection
          title="Minutas donde participé"
          description="Minutas donde apareces como participante y no como elaborador."
          titleIcon="FaUserCheck"
          actionLabel="Historial"
          actionIcon="history"
          onAction={() => navigate("/minutes")}
          minutes={participatedMinutes}
          emptyMessage="No hay minutas registradas con tu participación."
        />
      )}

      {w("tags_populares") && (
        <MinutesSection
          title="Minutas completadas recientes"
          description="Últimas minutas completadas donde eres el elaborador."
          titleIcon="FaCheckCircle"
          actionLabel="Ver todas"
          actionIcon="FaList"
          onAction={() => navigate("/minutes")}
          minutes={completedMinutes}
          emptyMessage="No tienes minutas completadas recientes."
        />
      )}

    </div>
  );
};

export default Dashboard;
