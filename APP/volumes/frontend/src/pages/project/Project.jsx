/**
 * Project.jsx
 * Componente monolítico para gestión de proyectos - 100% Tailwind CSS
 */

import React, { useState, useEffect } from 'react';
import projectsData from '@/data/dataProjectos.json';
import clientsData from '@/data/dataClientes.json'; // ✅ NUEVO
import ProjectHeader from './ProjectHeader';
import ProjectFilters from './ProjectFilters';
import ProjectStats from './ProjectStats';
import ProjectGrid from './ProjectGrid';
import PageLoadingSpinner from '@/components/ui/modal/types/system/PageLoadingSpinner';

import logger from '@/utils/logger';
const projectLog = logger.scope("project");

const Project = () => {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [clients] = useState(() => clientsData?.clients || []); // ✅ NUEVO (luego reemplazas por service)

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    client: ''
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    activos: 0,
    inactivos: 0,
    totalMinutas: 0
  });

  // Load data
  useEffect(() => {
    const loadProjects = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        setProjects(projectsData.projects || []);
        setFilteredProjects(projectsData.projects || []);
        calculateStats(projectsData.projects || []);
      } catch (error) {
        projectLog.error('[Proyectos] Error loading projects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProjects();
  }, []);

  // Calculate stats
  const calculateStats = (projectsList) => {
    const stats = {
      total: projectsList.length,
      activos: projectsList.filter(p => p.status === 'activo').length,
      inactivos: projectsList.filter(p => p.status === 'inactivo').length,
      totalMinutas: projectsList.reduce((sum, p) => sum + (p.minutas || 0), 0)
    };
    setStats(stats);
  };

  // Filter projects
  useEffect(() => {
    let filtered = [...projects];

    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(term) ||
        project.client.toLowerCase().includes(term) ||
        (project.description && project.description.toLowerCase().includes(term))
      );
    }

    if (filters.status) {
      filtered = filtered.filter(project => project.status === filters.status);
    }

    if (filters.client) {
      filtered = filtered.filter(project => project.client === filters.client);
    }

    setFilteredProjects(filtered);
  }, [filters, projects]);

  // Project handlers
  const handleEditProject = (updatedProject) => {
    const updatedProjects = projects.map(p =>
      p.id === updatedProject.id ? updatedProject : p
    );
    setProjects(updatedProjects);
    calculateStats(updatedProjects);
  };

  const handleDeleteProject = (projectId) => {
    const updatedProjects = projects.filter(p => p.id !== projectId);
    setProjects(updatedProjects);
    calculateStats(updatedProjects);
  };

  // Filter handlers
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: '',
      client: ''
    });
  };

  const handleApplyFilters = () => {
    projectLog.log('[Project] Filtros aplicados:', filters);
  };

  if (isLoading) {
    return <PageLoadingSpinner message="Cargando Proyectos..." />;
  }

  return (
    <div className="space-y-6">
      <ProjectHeader />

      <ProjectFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
        data={{}}
      />

      <ProjectStats stats={stats} />

      <ProjectGrid
        projects={filteredProjects}
        clients={clients}              // ✅ NUEVO
        onEdit={handleEditProject}
        onDelete={handleDeleteProject}
        hasFilters={!!(filters.search || filters.status || filters.client)}
      />
    </div>
  );
};

export default Project;