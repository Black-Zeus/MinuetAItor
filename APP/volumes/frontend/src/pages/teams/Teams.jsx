/**
 * Teams.jsx
 * Componente monolítico para gestión de equipo - alineado a Project.jsx
 */

import React, { useState, useEffect, useMemo } from "react";
import teamsData from "@/data/dataTeams.json";

import TeamsHeader from "./TeamsHeader";
import TeamsFilters from "./TeamsFilters";
import TeamsStats from "./TeamsStats";
import TeamsGrid from "./TeamsGrid";

import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";

const Teams = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters (misma filosofía que Project.jsx)
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    systemRole: "",
    client: "",
  });

  // Sort
  const [sortBy, setSortBy] = useState("name-asc");

  // Load data
  useEffect(() => {
    const loadTeams = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const list = teamsData?.teams || [];
        setUsers(list);
        setFilteredUsers(list);
      } catch (error) {
        console.error("[Teams] Error loading teams:", error);
        setUsers([]);
        setFilteredUsers([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadTeams();
  }, []);

  // Helpers: formateo (equivalente a tu formattedUsers, pero estable para sort/filters)
  const formattedUsers = useMemo(() => {
    return users.map((user) => {
      // Asignaciones: para UI (texto)
      let clientsText = "Todos";
      let projectsText = "Todos";

      if (user.assignmentMode === "specific") {
        const clientCount = user.clients?.length || 0;
        const projectCount = user.projects?.length || 0;
        clientsText = clientCount > 0 ? String(clientCount) : "Ninguno";
        projectsText = projectCount > 0 ? String(projectCount) : "Ninguno";
      }

      // Fechas: mantener ISO para ordenar + string formateado para mostrar
      const createdAtISO = user.createdAt ? new Date(user.createdAt).toISOString() : null;
      const createdAtLabel = user.createdAt
        ? new Date(user.createdAt).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—";

      return {
        ...user,
        clientsLabel: clientsText,
        projectsLabel: projectsText,
        createdAtISO,
        createdAtLabel,
      };
    });
  }, [users]);

  // Stats (mismo patrón que ProjectStats)
  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      inactive: users.filter((u) => u.status === "inactive").length,
      admins: users.filter((u) => u.systemRole === "admin").length,
    };
  }, [users]);

  // Filter users (misma filosofía que Project.jsx con useEffect)
  useEffect(() => {
    let filtered = [...formattedUsers];

    // search
    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = filtered.filter((u) => {
        return (
          String(u.name || "").toLowerCase().includes(term) ||
          String(u.email || "").toLowerCase().includes(term) ||
          String(u.position || "").toLowerCase().includes(term)
        );
      });
    }

    // status
    if (filters.status) {
      filtered = filtered.filter((u) => u.status === filters.status);
    }

    // systemRole
    if (filters.systemRole) {
      filtered = filtered.filter((u) => u.systemRole === filters.systemRole);
    }

    // client (si assignmentMode=all => pasa)
    if (filters.client) {
      filtered = filtered.filter((u) => {
        if (u.assignmentMode === "all") return true;
        const userClients = Array.isArray(u.clients) ? u.clients : [];
        return userClients.includes(filters.client);
      });
    }

    // sort (después de filtrar, para mantener consistencia)
    const sorted = [...filtered];
    switch (sortBy) {
      case "name-asc":
        sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        break;
      case "name-desc":
        sorted.sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")));
        break;
      case "date-created":
        sorted.sort((a, b) => {
          const da = a.createdAtISO ? new Date(a.createdAtISO).getTime() : 0;
          const db = b.createdAtISO ? new Date(b.createdAtISO).getTime() : 0;
          return db - da;
        });
        break;
      case "last-activity":
        sorted.sort((a, b) => {
          const da = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const db = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          return db - da;
        });
        break;
      default:
        break;
    }

    setFilteredUsers(sorted);
  }, [filters, formattedUsers, sortBy]);

  // Modal handlers
  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  // Filters handlers (alineado a Project.jsx; TeamsFilters usa onFilterChange({key:value}))
  const handleFilterChange = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: "",
      status: "",
      systemRole: "",
      client: "",
    });
  };

  const handleApplyFilters = () => {
    console.log("[Teams] Filtros aplicados:", filters);
  };

  const handleSortChange = (value) => setSortBy(value);

  if (isLoading) {
    return <PageLoadingSpinner message="Cargando equipos..." />;
  }

  const hasFilters = !!(filters.search || filters.status || filters.systemRole || filters.client);

  return (
    <div className="space-y-6">
      <TeamsHeader />

      <TeamsFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
        data={users}
      />

      <TeamsStats stats={stats} />

      <TeamsGrid
        users={filteredUsers.map((u) => ({
          ...u,
          // Adaptación mínima para tu TeamsCards: espera clients/projects/createdAt “display”
          clients: u.clientsLabel,
          projects: u.projectsLabel,
          createdAt: u.createdAtLabel,
        }))}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        hasFilters={hasFilters}
      />
    </div>
  );
};

export default Teams;