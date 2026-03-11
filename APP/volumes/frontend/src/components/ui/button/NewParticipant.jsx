import React from "react";
import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import ParticipantsModal, { PARTICIPANTS_MODAL_MODES } from "@/pages/participants/ParticipantsModal";
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

const NewParticipant = ({ onCreated }) => {
  const handleOpen = () => {
    ModalManager.show({
      type: "custom",
      title: "Nuevo Participante",
      size: "large",
      showFooter: false,
      content: (
        <ParticipantsModal
          mode={PARTICIPANTS_MODAL_MODES.CREATE}
          onSubmit={async (formData) => {
            try {
              const created = await participantsService.create(toApiPayload(formData));
              onCreated?.(created);
              toastSuccess("Participante creado", "El participante fue registrado correctamente.");
              ModalManager.closeAll?.();
            } catch (error) {
              toastError(
                "No se pudo crear",
                error?.response?.data?.error?.message ??
                  error?.response?.data?.detail ??
                  error?.message ??
                  "Error inesperado al crear el participante."
              );
              throw error;
            }
          }}
          onClose={() => ModalManager.closeAll?.()}
        />
      ),
    });
  };

  return (
    <ActionButton
      label="Nuevo Participante"
      onClick={handleOpen}
      variant="primary"
      icon={<Icon name="FaPlus" />}
    />
  );
};

export default NewParticipant;
