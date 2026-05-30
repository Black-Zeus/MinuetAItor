/**
 * ProjectHeader.jsx
 * Header del módulo de proyectos.
 * Recibe onCreated y clientCatalog desde Project.jsx y los pasa a NewProject.
 */

import React from 'react';
import ModuleHeader from '@/components/common/page/ModuleHeader';
import NewProject from '@/components/ui/button/NewProject';
import useSessionStore from '@/store/sessionStore';
import { canManageProjects } from '@/utils/authz';

const ProjectHeader = ({ onCreated, clientCatalog = [] }) => {
  const authz = useSessionStore((s) => s.authz);
  const canCreateProject = canManageProjects(authz);

  return (
    <ModuleHeader
      icon="FaFolderOpen"
      title="Proyectos"
      description="Gestiona todos tus proyectos y sus minutas asociadas"
      actions={
        canCreateProject ? (
          <NewProject
            onCreated={onCreated}
            clientCatalog={clientCatalog}
          />
        ) : null
      }
    />
  );
};

export default ProjectHeader;
