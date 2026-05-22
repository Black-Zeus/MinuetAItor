/**
 * NewProject.jsx
 * Botón que abre el modal para crear proyecto usando ProjectModal
 */

import React, { useCallback } from 'react';
import ActionButton from '@/components/ui/button/ActionButton';
import { FaPlus } from 'react-icons/fa';
import ModalManager from '@/components/ui/modal';
import ProjectModal, { PROJECT_MODAL_MODES } from '@/pages/project/ProjectModal';
import projectService from '@/services/projectService';

import logger from '@/utils/logger';
const projectLog = logger.scope("project");

// Mapea el formData del wizard → snake_case para el backend
const toApiPayload = (formData) => ({
  client_id:       formData.clientId          ?? null,
  name:            formData.projectName       ?? '',
  // code: omitido — el backend genera UUID v4 automáticamente al crear
  description:     formData.projectDescription ?? null,
  notes:           formData.projectNotes ?? null,
  tags:            formData.projectTags ?? null,
  status:          formData.projectStatus     ?? 'activo',
  is_active:       (formData.projectStatus ?? 'activo') === 'activo',
  is_confidential: Boolean(formData.isConfidential),
  auto_send_on_preview: Boolean(formData.autoSendOnPreview),
  auto_send_on_completed: Boolean(formData.autoSendOnCompleted),
  pdf_template_override: formData.pdfTemplateOverride || null,
});

const NewProject = ({ onCreated, clientCatalog = [] }) => {

  const showProjectWizard = useCallback(() => {
    ModalManager.show({
      type: 'custom',
      title: 'Crear Nuevo Proyecto',
      size: 'clientWide',
      showHeader: false,
      showFooter: false,
      content: (
        <ProjectModal
          mode={PROJECT_MODAL_MODES.CREATE}
          clientCatalog={clientCatalog}
          onSubmit={async (formData) => {
            const payload = toApiPayload(formData);
            return await projectService.create(payload);
          }}
          onSaved={async (created) => {
            try { await onCreated?.(created); } catch (e) {
              projectLog.error('[NewProject] Error ejecutando onCreated:', e);
            }
          }}
          onClose={() => {}}
        />
      ),
    });
  }, [onCreated, clientCatalog]);

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
