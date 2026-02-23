/**
 * NewClient.jsx
 * Botón que abre el modal para crear cliente usando ClientModal
 */

import React, { useCallback } from 'react';
import ActionButton from '@/components/ui/button/ActionButton';
import { FaPlus } from 'react-icons/fa';
import ModalManager from '@/components/ui/modal';
import ClientModal, { CLIENT_MODAL_MODES } from '@/pages/clientes/ClientModal';
import clientService from '@/services/clientService';

import logger from '@/utils/logger';
const clientLog = logger.scope("client");

const toApiPayload = (formData) => ({
  name: formData.companyName ?? '',
  legal_name: formData.companyLegalName ?? null,
  description: formData.description ?? null,
  industry: formData.industry ?? null,
  email: formData.companyEmail ?? null,
  phone: formData.companyPhone ?? null,
  website: formData.companyWebsite ?? null,
  address: formData.address ?? null,
  contact_name: formData.contactName ?? null,
  contact_email: formData.contactEmail ?? null,
  contact_phone: formData.contactPhone ?? null,
  contact_position: formData.contactPosition ?? null,
  contact_department: formData.contactDepartment ?? null,
  notes: formData.notes ?? null,
  tags: formData.tags ?? null,
  is_confidential: Boolean(formData.isConfidential),
});

const NewClient = ({ onCreated }) => {

  const showClientWizard = useCallback(() => {
    ModalManager.show({
      type: 'custom',
      title: 'Crear Nuevo Cliente',
      size: 'large',
      showFooter: false,
      content: (
        <ClientModal
          mode={CLIENT_MODAL_MODES.CREATE}
          onSubmit={async (formData) => {
            try {
              const payload = toApiPayload(formData);
              const created = await clientService.create(payload);

              // ✅ gatilla actualización SIEMPRE (sin depender del onClose)
              try {
                await onCreated?.(created);
              } catch (e) {
                clientLog.error('[NewClient] Error ejecutando onCreated:', e);
              }

              ModalManager.success({
                title: 'Cliente Creado',
                message: 'El cliente ha sido creado exitosamente.',
                onClose: () => ModalManager.closeAll(),
              });

            } catch (err) {
              clientLog.error('[NewClient] Error creando cliente:', err);
              ModalManager.error?.({
                title: 'Error',
                message: 'No se pudo crear el cliente. Intenta de nuevo.'
              });
            }
          }}
          onClose={() => {}}
        />
      )
    });
  }, [onCreated]);

  return (
    <ActionButton
      label="Nuevo Cliente"
      onClick={showClientWizard}
      variant="primary"
      icon={<FaPlus />}
    />
  );
};

export default NewClient;