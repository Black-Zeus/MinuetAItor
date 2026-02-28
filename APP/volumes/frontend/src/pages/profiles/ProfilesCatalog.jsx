/**
 * ProfilesCatalog.jsx
 * Gestión de Perfiles de Análisis — carga real desde API (profileService + profileCategoryService)
 * Patrón: Tags.jsx
 */

import React, { useState, useEffect, useCallback } from "react";
import profileService, { profileCategoryService } from "@/services/profileService";
import ProfilesCatalogHeader  from "./ProfilesCatalogHeader";
import ProfilesCatalogStats   from "./ProfilesCatalogStats";
import ProfilesCatalogFilters from "./ProfilesCatalogFilters";
import ProfilesCatalogGrid    from "./ProfilesCatalogGrid";
import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";

import logger from "@/utils/logger";
const profileLog = logger.scope("profiles");

// ─── Stats ────────────────────────────────────────────────────────────────────

const calcStats = (list) => ({
  total:      list.length,
  activos:    list.filter((p) => p.isActive).length,
  inactivos:  list.filter((p) => !p.isActive).length,
  conPrompt:  list.filter((p) => (p.prompt || "").trim()).length,
});

// ─── Filtro local ─────────────────────────────────────────────────────────────

const applyLocalFilters = (list, filters) => {
  let result = [...list];

  if (filters.search) {
    const term = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        (p.name        ?? "").toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term)
    );
  }

  if (filters.status) {
    const wantActive = filters.status === "activo";
    result = result.filter((p) => Boolean(p.isActive) === wantActive);
  }

  if (filters.categoryId) {
    result = result.filter(
      (p) => String(p.categoryId) === String(filters.categoryId)
    );
  }

  // Ordenamiento
  if (filters.sort === "az") {
    result.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  } else if (filters.sort === "za") {
    result.sort((a, b) => (b.name ?? "").localeCompare(a.name ?? ""));
  } else if (filters.sort === "categoria") {
    result.sort((a, b) => {
      const ca = a.category?.name ?? "";
      const cb = b.category?.name ?? "";
      if (ca === cb) return (a.name ?? "").localeCompare(b.name ?? "");
      return ca.localeCompare(cb);
    });
  }

  return result;
};

// ─── Componente ───────────────────────────────────────────────────────────────

const ProfilesCatalog = () => {
  const [profiles,         setProfiles]         = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [categories,       setCategories]       = useState([]);
  const [isLoading,        setIsLoading]        = useState(true);
  const [stats,            setStats]            = useState({
    total: 0, activos: 0, inactivos: 0, conPrompt: 0,
  });

  const [filters, setFilters] = useState({
    search:     "",
    status:     "",
    categoryId: "",
    sort:       "az",
  });

  // Pagination
  const [page, setPage]         = useState(1);
  const itemsPerPage             = 12;

  // ─── Carga inicial ──────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profilesResult, catsResult] = await Promise.all([
        profileService.list({ isActive: null, limit: 200 }),
        profileCategoryService.list({ isActive: true, limit: 200 }),
      ]);

      const pList = profilesResult.items ?? [];
      const cList = catsResult.items     ?? [];

      profileLog.log(`Cargados ${pList.length} perfiles, ${cList.length} categorías`);

      setProfiles(pList);
      setFilteredProfiles(pList);
      setCategories(cList);
      setStats(calcStats(pList));
    } catch (err) {
      profileLog.error("loadAll error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Filtro reactivo ────────────────────────────────────────────────────────

  useEffect(() => {
    const filtered = applyLocalFilters(profiles, filters);
    setFilteredProfiles(filtered);
    setPage(1);
  }, [filters, profiles]);

  // ─── Filtros ────────────────────────────────────────────────────────────────

  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ search: "", status: "", categoryId: "", sort: "az" });
  };

  const handleApplyFilters = () => {
    profileLog.log("Filtros aplicados:", filters);
  };

  // ─── Paginación ─────────────────────────────────────────────────────────────

  const totalPages       = Math.max(1, Math.ceil(filteredProfiles.length / itemsPerPage));
  const paginatedProfiles = filteredProfiles.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
  };

  // ─── Callbacks desde cards ──────────────────────────────────────────────────

  const handleUpdated = (updated) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
    setStats((prev) => calcStats(
      profiles.map((p) => (p.id === updated.id ? updated : p))
    ));
  };

  const handleDeleted = (id) => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== id);
      setStats(calcStats(next));
      return next;
    });
  };

  const handleCreated = (created) => {
    setProfiles((prev) => {
      const next = [created, ...prev];
      setStats(calcStats(next));
      return next;
    });
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <PageLoadingSpinner message="Cargando Perfiles de Análisis..." />;
  }

  return (
    <div className="space-y-6">
      <ProfilesCatalogHeader
        categories={categories}
        onCreated={handleCreated}
      />

      <ProfilesCatalogFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
        categories={categories}
        profiles={profiles}
      />

      <ProfilesCatalogStats stats={stats} />

      <ProfilesCatalogGrid
        profiles={paginatedProfiles}
        allProfiles={filteredProfiles}
        page={page}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
        categories={categories}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  );
};

export default ProfilesCatalog;