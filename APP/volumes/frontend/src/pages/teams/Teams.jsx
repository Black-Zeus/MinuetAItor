/**
 * Teams.jsx
 * Página principal del módulo Equipos
 * Patrón: loadAll con useCallback, calcStats runtime, applyLocalFilters, mutación optimista
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import teamsService from "@/services/teamsService";

import TeamsHeader  from "./TeamsHeader";
import TeamsFilters from "./TeamsFilters";
import TeamsStats   from "./TeamsStats";
import TeamsGrid    from "./TeamsGrid";

import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";

import logger from "@/utils/logger";
const teamsLog = logger.scope("teams");

// ─── helpers ─────────────────────────────────────────────────────────────────

const normalizeRole = (role) =>
  role ? String(role).toLowerCase() : "";

const calcStats = (users) => ({
  total:    users.length,
  active:   users.filter((u) => u.status === "active").length,
  inactive: users.filter((u) => u.status === "inactive").length,
  admins:   users.filter((u) => u.systemRole === "admin").length,
});

// ─── Component ────────────────────────────────────────────────────────────────

const Teams = () => {
  const [users,         setUsers]         = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [stats,         setStats]         = useState(calcStats([]));
  const [isLoading,     setIsLoading]     = useState(true);

  const [filters, setFilters] = useState({
    search:     "",
    status:     "",
    systemRole: "",
  });

  const [sortBy, setSortBy] = useState("name-asc");

  // ── 1. Carga inicial ──────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    try {
      setIsLoading(true);
      const { teams } = await teamsService.list({ skip: 0, limit: 200 });
      const normalized = (teams || []).map((t) => ({
        ...t,
        systemRole: normalizeRole(t.systemRole),
      }));
      setUsers(normalized);
      setStats(calcStats(normalized));
    } catch (error) {
      teamsLog.error("[Teams] Error cargando equipos:", error);
      setUsers([]);
      setStats(calcStats([]));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── 2. Filtrado local reactivo ────────────────────────────────────────────

  useEffect(() => {
    let filtered = [...users];

    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = filtered.filter((u) =>
        String(u.name     || "").toLowerCase().includes(term) ||
        String(u.email    || "").toLowerCase().includes(term) ||
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

    // Ordenamiento
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

  // ── 3. Handlers CRUD con mutación optimista ───────────────────────────────

  const handleCreated = useCallback((created) => {
    const normalized = { ...created, systemRole: normalizeRole(created.systemRole) };
    setUsers((prev) => {
      const next = [normalized, ...prev];
      setStats(calcStats(next));
      return next;
    });
  }, []);

  const handleUpdated = useCallback((updated) => {
    const normalized = { ...updated, systemRole: normalizeRole(updated.systemRole) };
    setUsers((prev) => {
      const next = prev.map((u) => (u.id === normalized.id ? normalized : u));
      setStats(calcStats(next));
      return next;
    });
  }, []);

  const handleDeleted = useCallback((id) => {
    setUsers((prev) => {
      const next = prev.filter((u) => u.id !== id);
      setStats(calcStats(next));
      return next;
    });
  }, []);

  // ── 4. Filter helpers ─────────────────────────────────────────────────────

  const handleFilterChange  = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const handleClearFilters  = () => setFilters({ search: "", status: "", systemRole: "" });
  const handleSortChange    = (value) => setSortBy(value);

  const hasFilters = !!(filters.search || filters.status || filters.systemRole);

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return <PageLoadingSpinner message="Cargando equipos..." />;

  return (
    <div className="space-y-6">
      <TeamsHeader onCreated={handleCreated} />

      <TeamsFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        data={users}
      />

      <TeamsStats stats={stats} />

      <TeamsGrid
        users={filteredUsers}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        hasFilters={hasFilters}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  );
};

export default Teams;