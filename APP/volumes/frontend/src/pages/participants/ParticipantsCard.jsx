import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import ActionButton from "@/components/ui/button/ActionButton";
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

const ParticipantsCard = ({ id, summary, onUpdated, onDeleted }) => {
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const primaryEmail = useMemo(() => {
    const emails = Array.isArray(summary?.emails) ? summary.emails : [];
    return emails.find((item) => item.isPrimary || item.is_primary) ?? emails[0] ?? null;
  }, [summary]);

  const fetchDetail = async () => {
    setIsLoadingDetail(true);
    try {
      return await participantsService.getById(id);
    } catch (error) {
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
      size: "large",
      showFooter: false,
      content: (
        <ParticipantsModal
          mode={mode}
          data={detail}
          onClose={() => ModalManager.closeAll?.()}
          onSubmit={async (formData) => {
            try {
              const updated = await participantsService.update(id, toApiPayload(formData));
              onUpdated?.(updated);
              toastSuccess("Participante actualizado", "Los cambios se guardaron correctamente.");
              ModalManager.closeAll?.();
            } catch (error) {
              toastError(
                "No se pudo actualizar",
                error?.response?.data?.error?.message ??
                  error?.response?.data?.detail ??
                  error?.message ??
                  "Error inesperado al actualizar el participante."
              );
              throw error;
            }
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{summary?.displayName ?? "—"}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{summary?.title || "Sin cargo"}</p>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              summary?.isActive
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            }`}
          >
            {summary?.isActive ? "Activo" : "Inactivo"}
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <Icon name="FaBuilding" className="w-4 h-4 text-gray-400" />
            <span className="truncate">{summary?.organization || "Sin organización"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="FaEnvelope" className="w-4 h-4 text-gray-400" />
            <span className="truncate">{primaryEmail?.email || "Sin correo registrado"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="FaUser" className="w-4 h-4 text-gray-400" />
            <span>{Array.isArray(summary?.emails) ? summary.emails.length : 0} correo(s)</span>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 grid grid-cols-3 gap-2">
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="eye" />}
            onClick={() => openModal(PARTICIPANTS_MODAL_MODES.VIEW)}
            disabled={isLoadingDetail}
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="edit" />}
            onClick={() => openModal(PARTICIPANTS_MODAL_MODES.EDIT)}
            disabled={isLoadingDetail}
          />
          <ActionButton
            variant="soft"
            size="xs"
            icon={<Icon name="delete" />}
            onClick={handleDelete}
            disabled={isLoadingDetail}
          />
        </div>
      </div>
    </div>
  );
};

export default ParticipantsCard;
