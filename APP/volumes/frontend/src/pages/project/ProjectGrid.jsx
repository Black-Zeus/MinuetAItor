/**
 * ProjectGrid.jsx
 * Grid de proyectos con estado vacío
 * Renderiza múltiples ProjectCard o muestra EmptyState
 */

import React from 'react';
import Icon from '@/components/ui/icon/iconManager';
import ProjectCard from './ProjectCard';

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META = "text-gray-500 dark:text-gray-400";

const EmptyState = ({ hasFilters }) => {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
        <Icon name="FaFolder" className={`${TXT_META} w-8 h-8`} />
      </div>
      <h3 className={`text-lg font-medium ${TXT_TITLE} mb-2 transition-theme`}>
        No se encontraron proyectos
      </h3>
      <p className={`${TXT_META}`}>
        {hasFilters ? 'Intenta ajustar los filtros' : 'Crea un nuevo proyecto para comenzar'}
      </p>
    </div>
  );
};

const ProjectGrid = ({ projects, onEdit, onDelete, hasFilters }) => {
  if (projects.length === 0) {
    return <EmptyState hasFilters={hasFilters} />;
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default ProjectGrid;