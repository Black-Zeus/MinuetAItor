/**
 * NewClient.jsx
 * Botón que abre el modal para crear cliente usando ClientModal (modo createNewClient)
 */

import React from 'react';
import ActionButton from '@/components/ui/button/ActionButton';
import { FaPlus } from 'react-icons/fa';
import ModalManager from '@/components/ui/modal';

// Import del componente único
import ClientModal, { CLIENT_MODAL_MODES } from '@/pages/clientes/ClientModal';

// Botón que abre el modal
const showClientWizard = () => {
  ModalManager.show({
    type: 'custom',
    title: 'Crear Nuevo Cliente',
    size: 'large',
    showFooter: false,
    content: (
      <ClientModal
        mode={CLIENT_MODAL_MODES.CREATE}
        onSubmit={(data) => {
          console.log('✅ Nuevo cliente:', data);

          ModalManager.success({
            title: 'Cliente Creado',
            message: 'El cliente ha sido creado exitosamente.'
          });
        }}
        onClose={() => {
          // cierre automático por ModalManager
        }}
      />
    )
  });
};

const NewClient = () => {
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