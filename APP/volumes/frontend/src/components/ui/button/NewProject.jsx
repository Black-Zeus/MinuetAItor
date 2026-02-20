/**
 * NewProject.jsx
 * Botón que abre el modal para crear proyecto usando ProjectModal (modo createNewProject)
 */

import React from 'react';
import ActionButton from '@/components/ui/button/ActionButton';
import { FaPlus } from 'react-icons/fa';
import ModalManager from '@/components/ui/modal';

// Import del componente único
import ProjectModal, { PROJECT_MODAL_MODES } from '@/pages/project/ProjectModal';

// (DEV) Catálogo de clientes. En PROD: reemplazar por service (GET /clients)
import clientsData from '@/data/dataClientes.json';

import logger from '@/utils/logger';
const projectLog = logger.scope("project");


// Botón que abre el modal
const showProjectWizard = () => {
  ModalManager.show({
    type: 'custom',
    title: 'Crear Nuevo Proyecto',
    size: 'large',
    showFooter: false,
    content: (
      <ProjectModal
        mode={PROJECT_MODAL_MODES.CREATE}
        clients={clientsData?.clients || []}
        onSubmit={(data) => {
          // data normalizado desde ProjectModal:
          // { projectName, projectDescription, projectStatus, projectTags, clientId, clientName, isConfidential, ... }
          projectLog.log('Nuevo proyecto:', data);

          // Aquí luego iría ProjectService.create(data)
          ModalManager.success({
            title: 'Proyecto Creado',
            message: 'El proyecto ha sido creado exitosamente.'
          });
        }}
        onClose={() => {
          // cierre automático por ModalManager
        }}
      />
    )
  });
};

const NewProject = () => {
  return (
    <ActionButton
      label="Nuevo Proyecto"
      onClick={showProjectWizard}
      variant="primary"
      icon={<FaPlus />}
    />
  );
};

export default NewProject;