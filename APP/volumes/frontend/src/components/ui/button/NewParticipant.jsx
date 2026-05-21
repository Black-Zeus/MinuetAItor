import React from "react";
import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import ParticipantsModal, { PARTICIPANTS_MODAL_MODES } from "@/pages/participants/ParticipantsModal";
import participantsService from "@/services/participantsService";

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
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <ParticipantsModal
          mode={PARTICIPANTS_MODAL_MODES.CREATE}
          onSubmit={async (formData) => {
            return await participantsService.create(toApiPayload(formData));
          }}
          onSaved={async (created) => {
            onCreated?.(created);
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
