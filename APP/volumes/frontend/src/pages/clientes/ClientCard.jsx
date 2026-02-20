/**
 * ClientCard.jsx
 * Tarjeta individual de cliente con acciones (Ver, Editar, Eliminar)
 * Incluye lógica de modales usando ModalManager
 */

import React from 'react';
import Icon from '@/components/ui/icon/iconManager';
import { ModalManager } from '@/components/ui/modal';
import ClientModal, { CLIENT_MODAL_MODES } from './ClientModal';
import ActionButton from '@/components/ui/button/ActionButton';

import logger from '@/utils/logger';
const clientLog = logger.scope("client");

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY = "text-gray-600 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const ClientCard = ({ client, onEdit, onDelete, onUpdate }) => {

  // Cierre defensivo (ModalManager puede variar según implementación)
  const closeModal = () => {
    ModalManager.hide?.();
    ModalManager.close?.();
    ModalManager.dismiss?.();
    ModalManager.closeAll?.();
  };

  // Normaliza el payload del modal (companyName/contactName/...) hacia el modelo base (company/name/...)
  const buildUpdatedClient = (base, payload = {}) => {
    const next = { ...base };

    // Soporta ambos esquemas (por compatibilidad)
    const companyName = payload.companyName ?? payload.company;
    const contactName = payload.contactName ?? payload.name;
    const contactEmail = payload.contactEmail ?? payload.email;
    const contactPhone = payload.contactPhone ?? payload.phone;
    const contactPosition = payload.contactPosition ?? payload.position;
    const companyWebsite = payload.companyWebsite ?? payload.website;

    if (companyName !== undefined) next.company = companyName;
    if (contactName !== undefined) next.name = contactName;
    if (contactEmail !== undefined) next.email = contactEmail;
    if (contactPhone !== undefined) next.phone = contactPhone;
    if (contactPosition !== undefined) next.position = contactPosition;
    if (companyWebsite !== undefined) next.website = companyWebsite;

    // Conserva id y demás campos no editables por el modal (industry/status/priority/source/projects/createdAt/etc.)
    // Si en el futuro el modal incorpora más campos editables, se deben mapear explícitamente aquí.

    return next;
  };

  // Status helpers
  const getStatusColor = (status) => {
    const colors = {
      'activo': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      'inactivo': 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
      'prospecto': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    };
    return colors[status] || colors.activo;
  };

  const getStatusText = (status) => {
    const texts = {
      'activo': 'Activo',
      'inactivo': 'Inactivo',
      'prospecto': 'Prospecto'
    };
    return texts[status] || status;
  };

  // Modal: Ver Detalles (COHERENTE con formulario de creación)
  const handleViewClient = () => {
    ModalManager.show({
      type: 'custom',
      title: 'Detalle Cliente',
      size: 'large',
      showFooter: false,
      content: (
        <ClientModal
          mode={CLIENT_MODAL_MODES.VIEW}
          data={client}
          onClose={closeModal}
        />
      )
    });
  };

  // Modal: Editar Cliente (COHERENTE con formulario de creación)
  const handleEditClient = () => {
    ModalManager.show({
      type: 'custom',
      title: 'Editar Cliente',
      size: 'large',
      showFooter: false,
      content: (
        <ClientModal
          mode={CLIENT_MODAL_MODES.EDIT}
          data={client}
          onSubmit={(payload) => {
            // El contenedor decide si hace PATCH al backend o actualiza state local
            const updatedClient = buildUpdatedClient(client, payload);
            onUpdate?.(updatedClient);

            // Hook opcional para telemetría/estado externo
            onEdit?.(client.id);

            closeModal();
          }}
          onClose={closeModal}
        />
      )
    });
  };

  // Eliminar Cliente
  const handleDeleteClient = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: 'Confirmar Eliminación',
        message: `¿Estás seguro de que deseas eliminar a ${client.name}? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      });

      if (confirmed) {
        onDelete(client.id);
      }
    } catch (error) {
      clientLog.log('[ClientCard] Eliminación cancelada');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
              <Icon name="FaUser" className="text-primary-600 dark:text-primary-400 w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`font-semibold ${TXT_TITLE} truncate transition-theme`}>{client.name}</h3>
              <p className={`text-sm ${TXT_META} truncate`}>{client.position || 'Sin cargo'}</p>
            </div>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)} flex-shrink-0`}>
            {getStatusText(client.status)}
          </span>
        </div>

        {/* Company Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Icon name="FaBuilding" className={`${TXT_META} w-4 h-4 flex-shrink-0`} />
            <span className={`${TXT_BODY} truncate transition-theme`}>{client.company}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Icon name="FaEnvelope" className={`${TXT_META} w-4 h-4 flex-shrink-0`} />
            <span className={`${TXT_BODY} truncate transition-theme`}>{client.email}</span>
          </div>
          {client.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Icon name="FaPhone" className={`${TXT_META} w-4 h-4 flex-shrink-0`} />
              <span className={`${TXT_BODY} transition-theme`}>{client.phone}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Icon name="FaFolder" className="text-primary-500 w-4 h-4" />
            <span className={`text-sm ${TXT_BODY} transition-theme`}>
              <span className={`font-semibold ${TXT_TITLE} transition-theme`}>{client.projects}</span>
              {' '}{client.projects === 1 ? 'proyecto' : 'proyectos'}
            </span>
          </div>
          {client.industry && (
            <div className="flex items-center gap-2">
              <Icon name="FaIndustry" className={`${TXT_META} w-4 h-4`} />
              <span className={`text-sm ${TXT_BODY} capitalize transition-theme`}>{client.industry}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2 mt-auto place-items-center">
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="eye" />}
            tooltip="Ver cliente"
            onClick={handleViewClient}
            className="w-full"
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="edit" />}
            tooltip="Editar cliente"
            onClick={handleEditClient}
            className="w-full"
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="delete" />}
            tooltip="Eliminar cliente"
            onClick={handleDeleteClient}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

export default ClientCard;