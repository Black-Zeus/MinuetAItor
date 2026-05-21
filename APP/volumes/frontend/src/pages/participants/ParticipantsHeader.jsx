import React from "react";
import ModuleHeader from "@/components/common/page/ModuleHeader";
import NewParticipant from "@/components/ui/button/NewParticipant";

const ParticipantsHeader = ({ onCreated }) => {
  return (
    <ModuleHeader
      icon="FaUsers"
      title="Participantes"
      description="Catálogo maestro de asistentes, invitados y contactos vinculados a minutas"
      actions={<NewParticipant onCreated={onCreated} />}
    />
  );
};

export default ParticipantsHeader;
