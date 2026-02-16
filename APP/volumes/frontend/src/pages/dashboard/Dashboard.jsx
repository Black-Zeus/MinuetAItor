import React, { useEffect, useState } from "react";
import dashboardData from "@/data/dataDashBoard.json";

import DashboardHeader from "./DashboardHeader";
import DashboardLoading from "./DashboardLoading";
import DashboardError from "./DashboardError";

import LoadingSpinner from "@/components/ui/modal/types/system/LoadingSpinner";

import MetricCard from "./MetricCard";
import RecentMinutesList from "./RecentMinutesList";
import ClientsActivityList from "./ClientsActivityList";
import PopularTags from "./PopularTags";

import { FaCalendarAlt, FaFileAlt, FaUsers } from "react-icons/fa";
import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";

// Tipografía (mismo enfoque que tu base)
export const TXT_TITLE = "text-gray-900 dark:text-white";
export const TXT_SUBTITLE = "text-gray-700 dark:text-gray-200";
export const TXT_BODY = "text-gray-600 dark:text-gray-300";
export const TXT_META = "text-gray-500 dark:text-gray-400";

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Luego podrás sustituirlo por contexto/auth store
  const [userName] = useState("John Doe");

  useEffect(() => {
    const loadData = async () => {
      try {
        // Simulación de fetch
        await new Promise((resolve) => setTimeout(resolve, 500));
        setData(dashboardData);
      } catch (error) {
        console.error("[Dashboard] Error loading dashboard data:", error);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleNewMinute = () => {
    // navigate("/minutes/new");
    console.log("[Dashboard] Nueva Minuta: pendiente de implementar");
  };

  const handleViewAllMinutes = () => {
    console.log("[Dashboard] Ver todas las minutas: pendiente");
  };

  const handleSelectMinute = (minute) => {
    console.log("[Dashboard] Selección de minuta:", minute?.id);
  };

  if (isLoading) {
    return <PageLoadingSpinner message="Cargando dashboard..." />;
  }


  if (!data) return <DashboardError message="Error al cargar los datos del dashboard" />;

  return (
    <div className="space-y-6 p-6 bg-background-light dark:bg-background-dark transition-theme min-h-screen">
      <DashboardHeader
        userName={userName}
        subtitle="Resumen de tu actividad en MinuetAItor"
        onNewMinute={handleNewMinute}
      />

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          icon={FaCalendarAlt}
          title="Minutas este mes"
          value={24}
          change={12}
          isNew={false}
          variant="primary"
        />

        <MetricCard
          icon={FaFileAlt}
          title="Minutas generadas"
          value={87}
          change={8}
          isNew={false}
          variant="warm"
        />

        <MetricCard
          icon={FaUsers}
          title="Equipos activos"
          value={8}
          change={2}
          isNew={true}
          variant="info"
        />
      </div>

      {/* MINUTAS RECIENTES */}
      <RecentMinutesList
        minutes={data.recentMinutes ?? []}
        onViewAll={handleViewAllMinutes}
        onSelectMinute={handleSelectMinute}
      />

      {/* CLIENTES + TAGS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClientsActivityList clients={data.clientsActivity ?? []} limit={5} />
        <PopularTags tags={data.tagsPopular ?? []} />
      </div>
    </div>
  );
};

export default Dashboard;
