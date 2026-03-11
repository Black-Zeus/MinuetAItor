/**
 * ProjectHeader.jsx
 * Header del módulo de proyectos.
 * Recibe onCreated y clientCatalog desde Project.jsx y los pasa a NewProject.
 */

import React from 'react';
import Icon from '@/components/ui/icon/iconManager';
import NewProject from '@/components/ui/button/NewProject';
import useSessionStore from '@/store/sessionStore';

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META  = "text-gray-600 dark:text-gray-300";

const ProjectHeader = ({ onCreated, clientCatalog = [] }) => {
  const authz = useSessionStore((s) => s.authz);
  const canManageProjects =
    Array.isArray(authz?.roles) && authz.roles.includes("ADMIN")
      ? true
      : Array.isArray(authz?.permissions) && authz.permissions.includes("clients.manage");

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

      {canManageProjects ? (
        <NewProject
          onCreated={onCreated}
          clientCatalog={clientCatalog}
        />
      ) : null}
    </div>
  );
};

export default ProjectHeader;
