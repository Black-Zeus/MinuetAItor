import React, { useState } from "react";

import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import { ModalManager } from "@/components/ui/modal";
import useSessionStore from "@/store/sessionStore";
import ClientModal, { CLIENT_MODAL_MODES } from "./ClientModal";
import clientService from "@/services/clientService";

import logger from "@/utils/logger";

const clientLog = logger.scope("client");

const toApiPayload = (formData) => ({
  name: formData.companyName ?? "",
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
  default_pdf_template: formData.defaultPdfTemplate || null,
});

const ClientViewActions = ({ id, summary = null, onUpdated, onDeleted, buttonClassName = "w-full" }) => {
  const [loadingDetail, setLoadingDetail] = useState(false);
  const authz = useSessionStore((state) => state.authz);
  const canManageClients =
    Array.isArray(authz?.roles) && authz.roles.includes("ADMIN")
      ? true
      : Array.isArray(authz?.permissions) && authz.permissions.includes("clients.manage");

  const fetchDetail = async () => {
    setLoadingDetail(true);
    try {
      return await clientService.getById(id);
    } catch (error) {
      clientLog.error("[ClientViewActions] Error cargando detalle:", id, error);
      return summary;
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeModal = () => {
    ModalManager.closeAll?.();
  };

  const handleView = async () => {
    const detail = await fetchDetail();
    if (!detail) return;

    ModalManager.show({
      type: "custom",
      title: "Detalle Cliente",
      size: "clientWide",
      showHeader: false,
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

  const handleEdit = async () => {
    const detail = await fetchDetail();
    if (!detail) return;

    ModalManager.show({
      type: "custom",
      title: "Editar Cliente",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <ClientModal
          mode={CLIENT_MODAL_MODES.EDIT}
          data={detail}
          onSubmit={async (formData) => clientService.update(id, toApiPayload(formData))}
          onSaved={async (updated) => {
            onUpdated?.(updated);
          }}
          onClose={closeModal}
        />
      ),
    });
  };

  const handleDelete = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: "Confirmar Eliminación",
        message: `¿Estás seguro de que deseas eliminar a ${summary?.name ?? "este cliente"}? Esta acción no se puede deshacer.`,
        confirmText: "Eliminar",
        cancelText: "Cancelar",
      });

      if (!confirmed) return;

      await clientService.softDelete(id);
      onDeleted?.(id);
    } catch (error) {
      clientLog.log("[ClientViewActions] Eliminación cancelada o fallida", error);
    }
  };

  return (
    <div className={`grid gap-2 ${canManageClients ? "grid-cols-3" : "grid-cols-1"}`}>
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="eye" />}
        tooltip="Ver cliente"
        onClick={handleView}
        className={buttonClassName}
        disabled={loadingDetail}
      />
      {canManageClients ? (
        <ActionButton
          variant="soft"
          size="xs"
          icon={<Icon name="edit" />}
          tooltip="Editar cliente"
          onClick={handleEdit}
          className={buttonClassName}
          disabled={loadingDetail}
        />
      ) : null}
      {canManageClients ? (
        <ActionButton
          variant="soft"
          size="xs"
          icon={<Icon name="delete" />}
          tooltip="Eliminar cliente"
          onClick={handleDelete}
          className={buttonClassName}
          disabled={loadingDetail}
        />
      ) : null}
    </div>
  );
};

export default ClientViewActions;
