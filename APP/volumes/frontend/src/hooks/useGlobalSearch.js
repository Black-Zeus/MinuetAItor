/**
 * useGlobalSearch.js
 * Hook centralizado de búsqueda global
 * Fuente: backend por módulo, normalizado a un shape común para la UI.
 */

import { useCallback, useRef, useState } from 'react';

import { clientService } from '@/services/clientService';
import { projectService } from '@/services/projectService';
import { profileService } from '@/services/profileService';
import { listMinutes } from '@/services/minutesService';
import { tagCategoryService, tagService } from '@/services/tagService';
import { teamsService } from '@/services/teamsService';

const DEFAULT_LIMIT = 5;

const normalizeStatus = (status, isActive) => {
  if (status) return String(status);
  return isActive ? 'active' : 'inactive';
};

const mapClient = (client) => ({
  id: client.id,
  label: client.name ?? '',
  sublabel: client.industry ?? '',
  meta: client.status ?? '',
  company: client.legalName ?? client.name ?? '',
  phone: client.contactPhone ?? client.phone ?? '',
  email: client.contactEmail ?? client.email ?? '',
  position: client.contactPosition ?? '',
  status: client.status ?? (client.isActive ? 'activo' : 'inactivo'),
  isConfidential: Boolean(client.isConfidential),
  navigateTo: '/clients',
  rawData: client,
});

const mapProject = (project) => ({
  id: project.id,
  label: project.name ?? '',
  sublabel: project.clientName ?? '',
  meta: project.isActive ? 'Activo' : 'Inactivo',
  client: project.clientName ?? '',
  description: project.description ?? '',
  status: normalizeStatus(null, project.isActive),
  isConfidential: Boolean(project.isConfidential),
  navigateTo: '/projects',
  rawData: project,
});

const mapMinute = (minute) => ({
  id: minute.id,
  label: minute.title ?? '',
  sublabel: minute.summary ?? '',
  meta: minute.date ?? '',
  status: minute.status ?? '',
  date: minute.date ?? '',
  isConfidential: false,
  navigateTo: `/minutes/process/${minute.id}`,
  rawData: minute,
});

const mapTeam = (team) => ({
  id: team.id,
  label: team.name ?? '',
  sublabel: team.position ?? '',
  meta: team.email ?? '',
  position: team.position ?? '',
  email: team.email ?? '',
  department: team.department ?? '',
  systemRole: String(team.systemRole ?? '').toLowerCase(),
  status: team.status ?? '',
  isConfidential: false,
  navigateTo: '/teams',
  rawData: team,
});

const mapTag = (tag, categoriesById) => ({
  id: tag.id,
  label: tag.name ?? '',
  sublabel: tag.description ?? '',
  meta: tag.status ?? '',
  category: categoriesById.get(tag.categoryId) ?? `Categoria ${tag.categoryId ?? ''}`.trim(),
  status: tag.status ?? (tag.isActive ? 'activo' : 'inactivo'),
  description: tag.description ?? '',
  isConfidential: false,
  navigateTo: '/settings/tags',
  rawData: tag,
});

const mapProfile = (profile) => ({
  id: profile.id,
  label: profile.name ?? '',
  sublabel: profile.category?.name ?? '',
  meta: profile.isActive ? 'Activo' : 'Inactivo',
  categoria: profile.category?.name ?? '',
  status: normalizeStatus(null, profile.isActive),
  description: profile.description ?? '',
  isConfidential: false,
  navigateTo: '/settings/profiles',
  rawData: profile,
});

const searchClientes = async (query, limit) => {
  const { items, total } = await clientService.list({
    limit,
    isActive: null,
    filters: { search: query },
  });
  return { items: items.map(mapClient), total };
};

const searchProyectos = async (query, limit) => {
  const { items, total } = await projectService.list({
    limit,
    isActive: null,
    filters: { search: query },
  });
  return { items: items.map(mapProject), total };
};

const searchMinutes = async (query, limit) => {
  const { minutes = [], total = 0 } = await listMinutes({ limit, q: query });
  return { items: minutes.map(mapMinute), total };
};

const searchTeams = async (query, limit) => {
  const { teams = [], total = 0 } = await teamsService.list({
    limit,
    filters: { search: query },
  });
  return { items: teams.map(mapTeam), total };
};

const searchTags = async (query, limit) => {
  const [{ items: tags, total }, { items: categories }] = await Promise.all([
    tagService.list({ limit, isActive: null, filters: { search: query } }),
    tagCategoryService.list({ limit: 200, isActive: null }),
  ]);
  const categoriesById = new Map(categories.map((category) => [category.id, category.name]));
  return { items: tags.map((tag) => mapTag(tag, categoriesById)), total };
};

const searchProfiles = async (query, limit) => {
  const { items, total } = await profileService.list({
    limit,
    isActive: null,
    filters: { search: query },
  });
  return { items: items.map(mapProfile), total };
};

export const SEARCH_MODULES = [
  { id: 'clientes', label: 'Clientes', icon: 'FaBuilding', fn: searchClientes },
  { id: 'proyectos', label: 'Proyectos', icon: 'FaFolderOpen', fn: searchProyectos },
  { id: 'minutes', label: 'Minutas', icon: 'FaFileAlt', fn: searchMinutes },
  { id: 'teams', label: 'Equipos', icon: 'FaUsers', fn: searchTeams },
  { id: 'tags', label: 'Etiquetas', icon: 'FaTag', fn: searchTags },
  { id: 'profiles', label: 'Perfiles IA', icon: 'FaBrain', fn: searchProfiles },
];

const useGlobalSearch = () => {
  const [results, setResults] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const requestSeqRef = useRef(0);

  const clearResults = useCallback(() => {
    requestSeqRef.current += 1;
    setResults({});
    setLastQuery('');
    setTotalCount(0);
    setIsLoading(false);
  }, []);

  const search = useCallback(async ({ query, modules = null, limit = DEFAULT_LIMIT }) => {
    const q = query.trim();
    if (!q) {
      clearResults();
      return;
    }

    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    setIsLoading(true);
    setLastQuery(q);

    const activeModules = modules
      ? SEARCH_MODULES.filter((module) => modules.includes(module.id))
      : SEARCH_MODULES;

    const settled = await Promise.allSettled(
      activeModules.map(async (module) => {
        const result = await module.fn(q, limit);
        return [module.id, result];
      }),
    );

    if (requestSeqRef.current !== requestId) return;

    const nextResults = {};
    let total = 0;

    settled.forEach((entry, index) => {
      const moduleId = activeModules[index].id;
      if (entry.status === 'fulfilled') {
        const [id, result] = entry.value;
        nextResults[id] = result.items;
        total += Number(result.total ?? result.items.length);
        return;
      }

      nextResults[moduleId] = [];
      console.error(`[global-search] Error en módulo ${moduleId}:`, entry.reason);
    });

    setResults(nextResults);
    setTotalCount(total);
    setIsLoading(false);
  }, [clearResults]);

  return {
    results,
    isLoading,
    lastQuery,
    totalCount,
    search,
    clearResults,
  };
};

export default useGlobalSearch;
