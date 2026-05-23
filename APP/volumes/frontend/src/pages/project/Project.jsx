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
import ProjectListView from './ProjectListView';
import ProjectTableView from './ProjectTableView';
import ProjectsGroupedByClient from './ProjectsGroupedByClient';
import CatalogBasePagination from '@/components/common/CatalogBasePagination';
import PageLoadingSpinner from '@/components/ui/modal/types/system/PageLoadingSpinner';
import useAbortableRequestScope from '@/hooks/useAbortableRequestScope';
import CatalogViewBar from '@/components/common/CatalogViewBar';
import CatalogPagePagination from '@/components/common/CatalogPagePagination';
import useModuleViewMode from '@/hooks/useModuleViewMode';

import logger from '@/utils/logger';
const projectLog = logger.scope("project");
const VIEW_OPTIONS = [
  { id: "base", label: "Base" },
  { id: "list", label: "Listado" },
  { id: "table", label: "Tabla" },
  { id: "client", label: "Por cliente" },
];
const DEFAULT_ITEMS_PER_PAGE = 18;
const TABLE_ITEMS_PER_PAGE = 100;

// ─── Stats ────────────────────────────────────────────────────────────────────

const calcStats = (list) => ({
  total:       list.length,
  activos:     list.filter((p) => Boolean(p.isActive)).length,
  inactivos:   list.filter((p) => !Boolean(p.isActive)).length,
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
    const wantActive = filters.status === "activo";
    result = result.filter((p) => Boolean(p.isActive) === wantActive);
  }

  if (filters.clientId) {
    result = result.filter((p) => String(p.clientId ?? '') === String(filters.clientId));
  }

  return result;
};

// ─── Componente ───────────────────────────────────────────────────────────────

const Project = () => {
  const requestScope = useAbortableRequestScope();
  const [projects,         setProjects]         = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [clientCatalog,    setClientCatalog]    = useState([]);
  const [isLoading,        setIsLoading]        = useState(true);
  const [stats,            setStats]            = useState({ total: 0, activos: 0, inactivos: 0, totalMinutas: 0 });
  const [viewMode, setViewMode] = useModuleViewMode(["base", "list", "table", "client"]);
  const [page, setPage] = useState(1);
  const itemsPerPage = viewMode === "table" ? TABLE_ITEMS_PER_PAGE : DEFAULT_ITEMS_PER_PAGE;

  const [filters, setFilters] = useState({
    search:   '',
    status:   '',
    clientId: '',
  });

  // ─── Carga inicial ──────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    const projectsRequest = requestScope.createRequestConfig();
    const clientsRequest = requestScope.createRequestConfig();
    setIsLoading(true);
    try {
      // Carga en paralelo
      const [projectsResult, clientsResult] = await Promise.all([
        projectService.list({ isActive: null }, projectsRequest),
        clientService.list({ isActive: true, limit: 200 }, clientsRequest),
      ]);

      if (requestScope.wasAborted(projectsRequest.signal) || requestScope.wasAborted(clientsRequest.signal)) return;

      const pList = projectsResult.items ?? [];
      const cList = clientsResult.items  ?? [];

      setProjects(pList);
      setFilteredProjects(pList);
      setStats(calcStats(pList));
      setClientCatalog(cList);

    } catch (err) {
      if (requestScope.wasAborted(projectsRequest.signal) || requestScope.wasAborted(clientsRequest.signal)) return;
      projectLog.error('[Project] Error cargando datos:', err);
    } finally {
      if (!requestScope.wasAborted(projectsRequest.signal) && !requestScope.wasAborted(clientsRequest.signal)) {
        setIsLoading(false);
      }
    }
  }, [requestScope]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Filtrado local reactivo ────────────────────────────────────────────────

  useEffect(() => {
    const filtered = applyLocalFilters(projects, filters);
    setFilteredProjects(filtered);
    setPage(1);
  }, [filters, projects]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / itemsPerPage));
  const paginatedProjects = filteredProjects.slice((page - 1) * itemsPerPage, page * itemsPerPage);

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

  const handlePageChange = (nextPage) => {
    if (nextPage >= 1 && nextPage <= totalPages) setPage(nextPage);
  };

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
        clientCatalog={clientCatalog}
      />

      <ProjectStats stats={stats} />

      <CatalogViewBar
        count={filteredProjects.length}
        singularLabel="proyecto"
        pluralLabel="proyectos"
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        options={VIEW_OPTIONS}
      />

      {viewMode === 'base' ? (
        <ProjectGrid
          projects={paginatedProjects}
          clientCatalog={clientCatalog}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          hasFilters={hasFilters}
        />
      ) : null}

      {viewMode === 'list' ? (
        <ProjectListView
          projects={paginatedProjects}
          clientCatalog={clientCatalog}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          hasFilters={hasFilters}
        />
      ) : null}

      {viewMode === 'table' ? (
        <ProjectTableView
          projects={paginatedProjects}
          clientCatalog={clientCatalog}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          hasFilters={hasFilters}
        />
      ) : null}

      {viewMode === 'client' ? (
        <ProjectsGroupedByClient
          projects={filteredProjects}
          clientCatalog={clientCatalog}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          hasFilters={hasFilters}
        />
      ) : null}

      {viewMode === 'base' ? (
        <CatalogBasePagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          total={filteredProjects.length}
          itemsPerPage={itemsPerPage}
          singularLabel="proyecto"
          pluralLabel="proyectos"
        />
      ) : null}

      {viewMode !== 'base' && viewMode !== 'client' ? (
        <CatalogPagePagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      ) : null}
    </div>
  );
};

export default Project;
