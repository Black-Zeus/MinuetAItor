/**
 * ProjectHeader.jsx
 * Header del módulo de proyectos con título y botón de nuevo proyecto
 */

import React from 'react';
import Icon from '@/components/ui/icon/iconManager';
import NewProject from '@/components/ui/button/NewProject';

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META = "text-gray-600 dark:text-gray-300";

const ProjectHeader = () => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className={`text-3xl font-bold ${TXT_TITLE} flex items-center gap-3 transition-theme`}>
          <Icon name="FaFolderOpen" className="text-primary-600 dark:text-primary-400 w-8 h-8" />
          Proyectos
        </h1>
        <p className={`${TXT_META} mt-2 transition-theme`}>
          Gestiona todos tus proyectos y sus minutas asociadas
        </p>
      </div>
      <NewProject />
    </div>
  );
};

export default ProjectHeader;