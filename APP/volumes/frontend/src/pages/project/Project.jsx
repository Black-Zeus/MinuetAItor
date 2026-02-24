/**
 * Project.jsx
 * Gestión de proyectos — carga real desde API (projectService + clientService)
 */

import React, { useState, useEffect, useCallback } from 'react';
import projectService from '@/services/projectService';
import clientService  from '@/services/clientService';
import ProjectHeader  from './ProjectHeader';
import ProjectFilters from './ProjectFilters';
import ProjectStats   from './ProjectStats';
import ProjectGrid    from './ProjectGrid';
import PageLoadingSpinner from '@/components/ui/modal/types/system/PageLoadingSpinner';

import logger from '@/utils/logger';
const projectLog = logger.scope("project");

// ─── Stats ────────────────────────────────────────────────────────────────────

const calcStats = (list) => ({
  total:       list.length,
  activos:     list.filter((p) => p.status === 'activo').length,
  inactivos:   list.filter((p) => p.status === 'inactivo').length,
  totalMinutas: list.reduce((sum, p) => sum + (Number(p.minutas) || 0), 0),
});

// ─── Filtro local ─────────────────────────────────────────────────────────────

const applyLocalFilters = (list, filters) => {
  let result = [...list];

  if (filters.search) {
    const term = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        (p.name        ?? '').toLowerCase().includes(term) ||
        (p.clientName  ?? p.client ?? '').toLowerCase().includes(term) ||
        (p.description ?? '').toLowerCase().includes(term) ||
        (p.code        ?? '').toLowerCase().includes(term)
    );
  }

  if (filters.status) {
    result = result.filter((p) => p.status === filters.status);
  }

  if (filters.clientId) {
    result = result.filter((p) => String(p.clientId ?? '') === String(filters.clientId));
  }

  return result;
};

// ─── Componente ───────────────────────────────────────────────────────────────

const Project = () => {
  const [projects,         setProjects]         = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [clientCatalog,    setClientCatalog]    = useState([]);
  const [isLoading,        setIsLoading]        = useState(true);
  const [stats,            setStats]            = useState({ total: 0, activos: 0, inactivos: 0, totalMinutas: 0 });

  const [filters, setFilters] = useState({
    search:   '',
    status:   '',
    clientId: '',
  });

  // ─── Carga inicial ──────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      // Carga en paralelo
      const [projectsResult, clientsResult] = await Promise.all([
        projectService.list({ isActive: null }),
        clientService.list({ isActive: true, limit: 200 }),
      ]);

      const pList = projectsResult.items ?? [];
      const cList = clientsResult.items  ?? [];

      setProjects(pList);
      setFilteredProjects(pList);
      setStats(calcStats(pList));
      setClientCatalog(cList);

    } catch (err) {
      projectLog.error('[Project] Error cargando datos:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Filtrado local reactivo ────────────────────────────────────────────────

  useEffect(() => {
    const filtered = applyLocalFilters(projects, filters);
    setFilteredProjects(filtered);
  }, [filters, projects]);

  // ─── Handlers CRUD ─────────────────────────────────────────────────────────

  // onCreated: recibe el objeto del backend y lo prepende a la lista
  const handleCreated = useCallback((created) => {
    setProjects((prev) => {
      const next = [created, ...prev];
      setStats(calcStats(next));
      return next;
    });
  }, []);

  // onUpdated: recibe el objeto actualizado y reemplaza en lista
  const handleUpdated = useCallback((updated) => {
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === updated.id ? updated : p));
      setStats(calcStats(next));
      return next;
    });
  }, []);

  // onDeleted: recibe id y lo elimina de la lista
  const handleDeleted = useCallback((deletedId) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== deletedId);
      setStats(calcStats(next));
      return next;
    });
  }, []);

  // ─── Filtros ───────────────────────────────────────────────────────────────

  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ search: '', status: '', clientId: '' });
  };

  const handleApplyFilters = () => {
    projectLog.log('[Project] Filtros aplicados:', filters);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <PageLoadingSpinner message="Cargando Proyectos..." />;
  }

  const hasFilters = !!(filters.search || filters.status || filters.clientId);

  return (
    <div className="space-y-6">
      <ProjectHeader
        onCreated={handleCreated}
        clientCatalog={clientCatalog}
      />

      <ProjectFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
        clientCatalog={clientCatalog}
      />

      <ProjectStats stats={stats} />

      <ProjectGrid
        projects={filteredProjects}
        clientCatalog={clientCatalog}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        hasFilters={hasFilters}
      />
    </div>
  );
};

export default Project;