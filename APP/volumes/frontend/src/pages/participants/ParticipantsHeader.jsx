import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import NewParticipant from "@/components/ui/button/NewParticipant";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META = "text-gray-600 dark:text-gray-300";

const ParticipantsHeader = ({ onCreated }) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className={`text-3xl font-bold ${TXT_TITLE} flex items-center gap-3 transition-theme`}>
          <Icon name="FaUsers" className="text-primary-600 dark:text-primary-400 w-8 h-8" />
          Participantes
        </h1>
        <p className={`${TXT_META} mt-2 transition-theme`}>
          Catálogo maestro de asistentes, invitados y contactos vinculados a minutas
        </p>
      </div>

      <NewParticipant onCreated={onCreated} />
    </div>
  );
};

export default ParticipantsHeader;
