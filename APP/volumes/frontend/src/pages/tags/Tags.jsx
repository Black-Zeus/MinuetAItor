/**
 * Tags.jsx
 * Gestión de Tags — carga real desde API (tagService + tagCategoryService)
 * Patrón: Project.jsx
 */

import React, { useState, useEffect, useCallback } from "react";
import tagService, { tagCategoryService } from "@/services/tagService";
import TagsHeader  from "./TagsHeader";
import TagsFilters from "./TagsFilters";
import TagsStats   from "./TagsStats";
import TagsGrid    from "./TagsGrid";
import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";

import logger from "@/utils/logger";
const tagLog = logger.scope("tags");

// ─── Stats ────────────────────────────────────────────────────────────────────

const calcStats = (list) => ({
  total:           list.length,
  activos:         list.filter((t) => t.isActive).length,
  inactivos:       list.filter((t) => !t.isActive).length,
  totalCategorias: new Set(list.map((t) => t.categoryId).filter(Boolean)).size,
});

// ─── Filtro local ─────────────────────────────────────────────────────────────

const applyLocalFilters = (list, filters) => {
  let result = [...list];

  if (filters.search) {
    const term = filters.search.toLowerCase();
    result = result.filter(
      (t) =>
        (t.name        ?? "").toLowerCase().includes(term) ||
        (t.description ?? "").toLowerCase().includes(term)
    );
  }

  if (filters.status) {
    result = result.filter((t) => t.status === filters.status);
  }

  if (filters.categoryId) {
    result = result.filter(
      (t) => String(t.categoryId) === String(filters.categoryId)
    );
  }

  return result;
};

// ─── Componente ───────────────────────────────────────────────────────────────

const Tags = () => {
  const [tags,           setTags]           = useState([]);
  const [filteredTags,   setFilteredTags]   = useState([]);
  const [categories,     setCategories]     = useState([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [stats,          setStats]          = useState({
    total: 0, activos: 0, inactivos: 0, totalCategorias: 0,
  });

  const [filters, setFilters] = useState({
    search:     "",
    status:     "",
    categoryId: "",
  });

  // ─── Carga inicial ──────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tagsResult, catsResult] = await Promise.all([
        tagService.list({ isActive: null, limit: 200 }),
        tagCategoryService.list({ isActive: true, limit: 200 }),
      ]);

      const tList = tagsResult.items ?? [];
      const cList = catsResult.items ?? [];

      setTags(tList);
      setFilteredTags(tList);
      setCategories(cList);
      setStats(calcStats(tList));
    } catch (err) {
      tagLog.error("Error cargando tags:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Filtro reactivo ────────────────────────────────────────────────────────

  useEffect(() => {
    setFilteredTags(applyLocalFilters(tags, filters));
  }, [filters, tags]);

  // ─── Filter handlers ────────────────────────────────────────────────────────

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ search: "", status: "", categoryId: "" });
  };

  // ─── CRUD handlers (mutación optimista) ────────────────────────────────────

  const handleCreated = useCallback((created) => {
    setTags((prev) => {
      const next = [created, ...prev];
      setFilteredTags(applyLocalFilters(next, filters));
      setStats(calcStats(next));
      return next;
    });
  }, [filters]);

  const handleUpdated = useCallback((updated) => {
    setTags((prev) => {
      const next = prev.map((t) => (t.id === updated.id ? updated : t));
      setFilteredTags(applyLocalFilters(next, filters));
      setStats(calcStats(next));
      return next;
    });
  }, [filters]);

  const handleDeleted = useCallback((id) => {
    setTags((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setFilteredTags(applyLocalFilters(next, filters));
      setStats(calcStats(next));
      return next;
    });
  }, [filters]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <PageLoadingSpinner message="Cargando Tags..." />;
  }

  return (
    <div className="space-y-6">
      <TagsHeader
        onCreated={handleCreated}
        categories={categories}
      />

      <TagsFilters
        filters={filters}
        categories={categories}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      <TagsStats stats={stats} />

      <TagsGrid
        tags={filteredTags}
        categories={categories}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        hasFilters={!!(filters.search || filters.status || filters.categoryId)}
      />
    </div>
  );
};

export default Tags;