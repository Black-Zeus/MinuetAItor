/**
 * Teams.jsx
 * Listado + filtros livianos (sin depender de detalle)
 */

import React, { useEffect, useMemo, useState } from "react";
import teamsService from "@/services/teamsService";

import TeamsHeader from "./TeamsHeader";
import TeamsFilters from "./TeamsFilters";
import TeamsStats from "./TeamsStats";
import TeamsGrid from "./TeamsGrid";

import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";

import logger from "@/utils/logger";
const teamsLog = logger.scope("teams");

// Normaliza ADMIN -> admin para que tus filtros/stats no fallen
const normalizeRole = (role) => (role ? String(role).toLowerCase() : "");

const Teams = () => {
  const [users, setUsers] = useState([]);          // DTO mínimo
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    systemRole: "",
    // client: ""  // ⚠️ si list no trae clients, este filtro debe ir al backend o deshabilitarse
  });

  const [sortBy, setSortBy] = useState("name-asc");

  useEffect(() => {
    const loadTeams = async () => {
      try {
        await new Promise((r) => setTimeout(r, 150));

        // Si quieres filtros server-side: pásalos aquí
        const { teams } = await teamsService.list({ skip: 0, limit: 50 });

        // Normaliza solo lo necesario para UI
        const normalized = (teams || []).map((t) => ({
          ...t,
          systemRole: normalizeRole(t.systemRole),
        }));

        setUsers(normalized);
        setFilteredUsers(normalized);
      } catch (error) {
        teamsLog.error("[Teams] Error loading teams:", error);
        setUsers([]);
        setFilteredUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeams();
  }, []);

  // Stats basados en list mínimo
  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      inactive: users.filter((u) => u.status === "inactive").length,
      admins: users.filter((u) => u.systemRole === "admin").length,
    };
  }, [users]);

  // Filtering local (solo campos disponibles en list)
  useEffect(() => {
    let filtered = [...users];

    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = filtered.filter((u) =>
        String(u.name || "").toLowerCase().includes(term) ||
        String(u.email || "").toLowerCase().includes(term) ||
        String(u.position || "").toLowerCase().includes(term) ||
        String(u.username || "").toLowerCase().includes(term)
      );
    }

    if (filters.status) {
      filtered = filtered.filter((u) => u.status === filters.status);
    }

    if (filters.systemRole) {
      filtered = filtered.filter((u) => u.systemRole === filters.systemRole);
    }

    // Sort (sin fechas si no vienen en list)
    const sorted = [...filtered];
    switch (sortBy) {
      case "name-asc":
        sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        break;
      case "name-desc":
        sorted.sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")));
        break;
      default:
        break;
    }

    setFilteredUsers(sorted);
  }, [filters, users, sortBy]);

  const handleFilterChange = (patch) => setFilters((prev) => ({ ...prev, ...patch }));

  const handleClearFilters = () => {
    setFilters({
      search: "",
      status: "",
      systemRole: "",
    });
  };

  const handleApplyFilters = () => teamsLog.log("[Teams] Filtros aplicados:", filters);

  const handleSortChange = (value) => setSortBy(value);

  if (isLoading) return <PageLoadingSpinner message="Cargando equipos..." />;

  const hasFilters = !!(filters.search || filters.status || filters.systemRole);

  return (
    <div className="space-y-6">
      <TeamsHeader />

      <TeamsFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
        data={users}
        // ⚠️ Si tu TeamsFilters muestra "client", debes ocultarlo o moverlo a server-side
      />

      <TeamsStats stats={stats} />

      <TeamsGrid
        // ✅ aquí NO transformes clients/projects/createdAt, porque la card (por id) hará GET on-demand
        users={filteredUsers}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        hasFilters={hasFilters}
      />
    </div>
  );
};

export default Teams;
