/**
 * ClientCard.jsx
 * Recibe id + summary (DTO mínimo del list).
 * El detalle completo se carga on-demand al abrir View o Edit.
 */

import React, { useState } from 'react';
import Icon from '@/components/ui/icon/iconManager';
import { ModalManager } from '@/components/ui/modal';
import ClientModal, { CLIENT_MODAL_MODES } from './ClientModal';
import ActionButton from '@/components/ui/button/ActionButton';
import clientService from '@/services/clientService';

import logger from '@/utils/logger';
const clientLog = logger.scope("client");

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY = "text-gray-600 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const ClientCard = ({ id, summary = null, onUpdated, onDeleted }) => {
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ─── Helpers de status ────────────────────────────────────────────────────

  const toApiPayload = (formData) => ({
    // Empresa
    name: formData.companyName ?? '',
    legal_name: formData.companyLegalName ?? null,
    email: formData.companyEmail ?? null,
    phone: formData.companyPhone ?? null,
    website: formData.companyWebsite ?? null,

    // Contacto
    contact_name: formData.contactName ?? null,
    contact_email: formData.contactEmail ?? null,
    contact_phone: formData.contactPhone ?? null,
    contact_position: formData.contactPosition ?? null,
    contact_department: formData.contactDepartment ?? null,

    // Contenido libre
    notes: formData.notes ?? null,
    tags: formData.tags ?? null,

    // Gobernanza
    is_confidential: Boolean(formData.isConfidential),
  });

  // ─── Carga de detalle on-demand ───────────────────────────────────────────

  const fetchDetail = async () => {
    setLoadingDetail(true);
    try {
      const detail = await clientService.getById(id);
      return detail;
    } catch (err) {
      clientLog.error('[ClientCard] Error cargando detalle:', id, err);
      // Fallback al summary si el detalle falla
      return summary;
    } finally {
      setLoadingDetail(false);
    }
  };

  // ─── Cierre modal ─────────────────────────────────────────────────────────

  const closeModal = () => {
    ModalManager.closeAll?.();
  };

  // ─── Modal: Ver Detalle ───────────────────────────────────────────────────

  const handleViewClient = async () => {
    const detail = await fetchDetail();
    if (!detail) return;

    ModalManager.show({
      type: 'custom',
      title: 'Detalle Cliente',
      size: 'large',
      showFooter: false,
      content: (
        <ClientModal
          mode={CLIENT_MODAL_MODES.VIEW}
          data={detail}
          onClose={closeModal}
        />
      ),
    });
  };

  // ─── Modal: Editar ────────────────────────────────────────────────────────

  const handleEditClient = async () => {
    const detail = await fetchDetail();
    if (!detail) return;

    ModalManager.show({
      type: 'custom',
      title: 'Editar Cliente',
      size: 'large',
      showFooter: false,
      content: (
        <ClientModal
          mode={CLIENT_MODAL_MODES.EDIT}
          data={detail}
          onSubmit={async (formData) => {
            try {
              const payload = toApiPayload(formData);
              const updated = await clientService.update(id, payload);
              onUpdated?.(updated);
            } catch (err) {
              clientLog.error('[ClientCard] Error actualizando cliente:', err);
            }
          }}
          onClose={closeModal}
        />
      ),
    });
  };

  // ─── Eliminar ─────────────────────────────────────────────────────────────

  const handleDeleteClient = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: 'Confirmar Eliminación',
        message: `¿Estás seguro de que deseas eliminar a ${summary?.name ?? 'este cliente'}? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
      });

      if (confirmed) {
        await clientService.softDelete(id);
        onDeleted?.(id);
      }
    } catch (err) {
      clientLog.log('[ClientCard] Eliminación cancelada o fallida', err);
    }
  };

  // ─── Render (usa summary para mostrar la card) ────────────────────────────

  const name = summary?.name ?? '—';
  const industry = summary?.industry ?? null;
  const isActive = summary?.isActive ?? true;

  // ✅ tu API retorna isConfidential (camelCase)
  const isConfidential = Boolean(summary?.isConfidential);
  // si en algún punto normalizas a snake_case, usa:
  // const isConfidential = Boolean(summary?.is_confidential);

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
              <h3 className={`font-semibold ${TXT_TITLE} truncate transition-theme`}>{name}</h3>
              <p className={`text-sm ${TXT_META} truncate`}>{summary?.description ?? 'Sin descripción'}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isConfidential ? (
              <span
                className="
                  px-2 py-1 rounded-full text-xs font-semibold
                  bg-red-100 dark:bg-red-900/30
                  text-red-700 dark:text-red-300
                  border border-red-200 dark:border-red-800/60
                  transition-theme
                "
                title="Cliente confidencial (acceso restringido)"
              >
                Confidencial
              </span>
            ) : null}

            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                isActive
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100  dark:bg-gray-700       text-gray-700  dark:text-gray-400'
              }`}
            >
              {isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2 mb-4">
          {industry && (
            <div className="flex items-center gap-2 text-sm">
              <Icon name="FaIndustry" className={`${TXT_META} w-4 h-4 flex-shrink-0`} />
              <span className={`${TXT_BODY} capitalize truncate transition-theme`}>{industry}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Icon name="FaCalendarPlus" className={`${TXT_META} w-4 h-4 flex-shrink-0`} />
            <span className={`${TXT_META} transition-theme`}>
              {summary?.createdAt
                ? new Date(summary.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-2 place-items-center">
            <ActionButton
              variant="soft"
              size="xs"
              icon={<Icon name="eye" />}
              tooltip="Ver cliente"
              onClick={handleViewClient}
              className="w-full"
              disabled={loadingDetail}
            />
            <ActionButton
              variant="soft"
              size="xs"
              icon={<Icon name="edit" />}
              tooltip="Editar cliente"
              onClick={handleEditClient}
              className="w-full"
              disabled={loadingDetail}
            />
            <ActionButton
              variant="soft"
              size="xs"
              icon={<Icon name="delete" />}
              tooltip="Eliminar cliente"
              onClick={handleDeleteClient}
              className="w-full"
              disabled={loadingDetail}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default ClientCard;