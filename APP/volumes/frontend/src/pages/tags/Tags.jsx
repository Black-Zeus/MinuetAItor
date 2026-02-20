/**
 * Tags.jsx
 * Gestión de Tags - alineado a Project.jsx
 * - ID canónico: tag.id (numérico)
 * - Modal Create lo abre Tags.jsx (similar a ProjectCard)
 * - Edit/Delete lo ejecuta TagsCard (card abre modal y llama onEdit/onDelete)
 */

import React, { useEffect, useMemo, useState } from "react";
import TagsHeader from "./TagsHeader";
import TagsStats from "./TagsStats";
import TagsFilters from "./TagsFilters";
import TagsGrid from "./TagsGrid";

import dataTags from "@/data/dataTags.json";
import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";
import ModalManager from "@/components/ui/modal";

import TagsModal, { TAGS_MODAL_MODES } from "@/pages/tags/TagsModal";

import logger from '@/utils/logger';
const tagLog = logger.scope("tag");

const STORAGE_KEY = "minuetaitor_tag_catalog_v2"; // ✅ cambia versión por migración a id numérico

// ============================
// Helpers
// ============================
const normalizeText = (v) => String(v ?? "").trim();
const normalizeStatus = (v) => (v === "inactive" ? "inactive" : "active");

const normalizeTag = (t) => {
  const idRaw = t?.id;
  const id =
    idRaw !== undefined && idRaw !== null && String(idRaw).trim() !== ""
      ? Number.isFinite(Number(idRaw))
        ? Number(idRaw)
        : idRaw
      : undefined;

  return {
    id,
    name: normalizeText(t?.name),
    description: normalizeText(t?.description),
    status: normalizeStatus(t?.status),
    category: normalizeText(t?.category) || "General",
  };
};

const Tags = () => {
  const [tags, setTags] = useState([]);
  const [filteredTags, setFilteredTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters (alineado a Project.jsx)
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    category: "",
  });

  // Stats (alineado a Project.jsx)
  const [stats, setStats] = useState({
    total: 0,
    activos: 0,
    inactivos: 0,
    totalCategorias: 0,
  });

  // Catálogo base desde JSON (ya viene con id 1..N)
  const baseCatalog = useMemo(() => {
    const base = Array.isArray(dataTags) ? dataTags : dataTags?.tags ?? [];
    return base
      .map(normalizeTag)
      .filter((t) => t.id !== undefined && t.name);
  }, []);

  const saveToStorage = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const calculateStats = (tagsList) => {
    const categories = new Set(
      tagsList.map((t) => normalizeText(t.category)).filter(Boolean)
    );

    setStats({
      total: tagsList.length,
      activos: tagsList.filter((t) => t.status === "active").length,
      inactivos: tagsList.filter((t) => t.status === "inactive").length,
      totalCategorias: categories.size,
    });
  };

  // Load data (localStorage -> fallback JSON baseCatalog)
  useEffect(() => {
    const loadTags = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
          setTags(baseCatalog);
          setFilteredTags(baseCatalog);
          calculateStats(baseCatalog);
          saveToStorage(baseCatalog);
          return;
        }

        try {
          const parsed = JSON.parse(raw);
          const normalized = (Array.isArray(parsed) ? parsed : [])
            .map(normalizeTag)
            .filter((t) => t.id !== undefined && t.name);

          const finalData = normalized.length ? normalized : baseCatalog;

          setTags(finalData);
          setFilteredTags(finalData);
          calculateStats(finalData);
          saveToStorage(finalData);
        } catch {
          setTags(baseCatalog);
          setFilteredTags(baseCatalog);
          calculateStats(baseCatalog);
          saveToStorage(baseCatalog);
        }
      } catch (error) {
        tagLog.error("[Tags] Error loading tags:", error);
        setTags(baseCatalog);
        setFilteredTags(baseCatalog);
        calculateStats(baseCatalog);
        saveToStorage(baseCatalog);
      } finally {
        setIsLoading(false);
      }
    };

    loadTags();
  }, [baseCatalog]);

  // Filter tags (alineado a Project.jsx)
  useEffect(() => {
    let filtered = [...tags];

    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = filtered.filter((tag) => {
        const name = tag.name?.toLowerCase() ?? "";
        const desc = tag.description?.toLowerCase() ?? "";
        const cat = tag.category?.toLowerCase() ?? "";
        return name.includes(term) || desc.includes(term) || cat.includes(term);
      });
    }

    if (filters.status) {
      filtered = filtered.filter((tag) => tag.status === filters.status);
    }

    if (filters.category) {
      filtered = filtered.filter((tag) => tag.category === filters.category);
    }

    setFilteredTags(filtered);
  }, [filters, tags]);

  // Filter handlers
  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ search: "", status: "", category: "" });
  };

  const handleApplyFilters = () => {
    tagLog.log("[Tags] Filtros aplicados:", filters);
  };

  // ============================
  // CRUD handlers (Project-like)
  // ============================

  const getNextId = (list) => {
    const maxId = list.reduce((max, t) => (Number(t.id) > max ? Number(t.id) : max), 0);
    return maxId + 1;
  };

  const handleCreateTag = () => {
    ModalManager.show({
      type: "custom",
      title: "Crear Etiqueta",
      size: "large",
      showFooter: false,
      content: (
        <TagsModal
          mode={TAGS_MODAL_MODES.CREATE}
          data={null}
          onClose={() => {}}
          onSubmit={(payload) => {
            const next = normalizeTag({
              id: getNextId(tags),
              name: payload.tagName,
              description: payload.tagDescription,
              status: payload.tagStatus,
              category: "General",
            });

            // Regla: name único (case-insensitive)
            const exists = tags.some(
              (t) => t.name.toLowerCase() === next.name.toLowerCase()
            );
            if (exists) {
              ModalManager.error?.({
                title: "Nombre duplicado",
                message: "Ya existe una etiqueta con ese nombre (debe ser único).",
              });
              return;
            }

            const updated = [next, ...tags];
            setTags(updated);
            setFilteredTags(updated);
            calculateStats(updated);
            saveToStorage(updated);

            ModalManager.success({
              title: "Etiqueta Creada",
              message: "La etiqueta fue creada exitosamente.",
            });
          }}
        />
      ),
    });
  };

  // Edit: viene desde TagsCard (ya abrió modal)
  const handleEditTag = (updatedTag) => {
    const normalized = normalizeTag(updatedTag);
    const updated = tags.map((t) => (t.id === normalized.id ? normalized : t));
    setTags(updated);
    setFilteredTags(updated);
    calculateStats(updated);
    saveToStorage(updated);
  };

  // Delete: viene desde TagsCard (ya confirmó)
  const handleDeleteTag = (tagId) => {
    const updated = tags.filter((t) => t.id !== tagId);
    setTags(updated);
    setFilteredTags(updated);
    calculateStats(updated);
    saveToStorage(updated);
  };

  const handleToggleStatus = (tagId) => {
    const updated = tags.map((t) =>
      t.id === tagId ? { ...t, status: t.status === "active" ? "inactive" : "active" } : t
    );
    setTags(updated);
    setFilteredTags(updated);
    calculateStats(updated);
    saveToStorage(updated);
  };

  const handleResetCatalog = () => {
    ModalManager.confirm({
      title: "Restaurar Catálogo",
      message:
        "Restaurar catálogo base reemplazará el contenido actual en este navegador.",
      description: "¿Continuar?",
      confirmText: "Restaurar",
      cancelText: "Cancelar",
      variant: "danger",
    })
      .then((confirmed) => {
        if (!confirmed) return;
        setTags(baseCatalog);
        setFilteredTags(baseCatalog);
        calculateStats(baseCatalog);
        saveToStorage(baseCatalog);
      })
      .catch(() => {});
  };

  if (isLoading) {
    return <PageLoadingSpinner message="Cargando Tags..." />;
  }

  return (
    <div className="space-y-6">
      <TagsHeader onCreateTag={handleCreateTag} onResetCatalog={handleResetCatalog} />

      <TagsFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
        data={{}}
      />

      <TagsStats tags={tags} stats={stats} />

      <TagsGrid
        tags={filteredTags}
        onEdit={handleEditTag}
        onDelete={handleDeleteTag}
        onToggleStatus={handleToggleStatus}
        hasFilters={!!(filters.search || filters.status || filters.category)}
      />
    </div>
  );
};

export default Tags;