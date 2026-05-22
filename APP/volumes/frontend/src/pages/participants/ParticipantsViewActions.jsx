import React, { useMemo, useState } from "react";

import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import ModalManager from "@/components/ui/modal";
import ParticipantsModal, { PARTICIPANTS_MODAL_MODES } from "./ParticipantsModal";
import participantsService from "@/services/participantsService";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";

const toApiPayload = (formData) => ({
  displayName: formData.displayName ?? "",
  organization: formData.organization || null,
  title: formData.title || null,
  notes: formData.notes || null,
  isActive: formData.isActive ?? true,
  emails: (formData.emails ?? [])
    .map((item) => ({
      id: item.id ?? null,
      email: String(item.email ?? "").trim().toLowerCase(),
      isPrimary: Boolean(item.isPrimary),
      isActive: Boolean(item.isActive ?? true),
    }))
    .filter((item) => item.email),
});

const ParticipantsViewActions = ({ id, summary, onUpdated, onDeleted, buttonClassName = "w-full" }) => {
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const primaryEmail = useMemo(() => {
    const emails = Array.isArray(summary?.emails) ? summary.emails : [];
    return emails.find((item) => item.isPrimary || item.is_primary) ?? emails[0] ?? null;
  }, [summary]);

  const fetchDetail = async () => {
    setIsLoadingDetail(true);
    try {
      return await participantsService.getById(id);
    } catch (_) {
      return summary;
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const openModal = async (mode) => {
    const detail = await fetchDetail();
    if (!detail) return;

    ModalManager.show({
      type: "custom",
      title: mode === PARTICIPANTS_MODAL_MODES.VIEW ? "Detalle participante" : "Editar participante",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <ParticipantsModal
          mode={mode}
          data={detail}
          onClose={() => ModalManager.closeAll?.()}
          onSubmit={async (formData) => participantsService.update(id, toApiPayload(formData))}
          onSaved={async (updated) => {
            onUpdated?.(updated);
          }}
        />
      ),
    });
  };

  const handleDelete = async () => {
    try {
      const confirmed = await ModalManager.confirm({
        title: "Eliminar participante",
        message: `¿Deseas eliminar a ${summary?.displayName ?? "este participante"}?`,
        confirmText: "Eliminar",
        cancelText: "Cancelar",
      });

      if (!confirmed) return;

      await participantsService.softDelete(id);
      onDeleted?.(id);
      toastSuccess("Participante eliminado", "El registro fue dado de baja.");
    } catch (error) {
      toastError("No se pudo eliminar", error?.message ?? "La operación no pudo completarse.");
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="eye" />}
        tooltip={`Ver participante${primaryEmail?.email ? `: ${primaryEmail.email}` : ""}`}
        onClick={() => openModal(PARTICIPANTS_MODAL_MODES.VIEW)}
        className={buttonClassName}
        disabled={isLoadingDetail}
      />
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="edit" />}
        tooltip="Editar participante"
        onClick={() => openModal(PARTICIPANTS_MODAL_MODES.EDIT)}
        className={buttonClassName}
        disabled={isLoadingDetail}
      />
      <ActionButton
        variant="soft"
        size="xs"
        icon={<Icon name="delete" />}
        tooltip="Eliminar participante"
        onClick={handleDelete}
        className={buttonClassName}
        disabled={isLoadingDetail}
      />
    </div>
  );
};

export default ParticipantsViewActions;
