// src/pages/minutes/components/MinutesHeader.jsx
import React from "react";
import ModuleHeader from "@/components/common/page/ModuleHeader";
import NewMinute from "@/components/ui/button/NewMinute";

const MinutesHeader = ({ onNewMinute }) => {
  return (
    <ModuleHeader
      icon="fileLines"
      title="Minutas"
      description="Gestiona y organiza todas tus minutas de reuniones"
      actions={<NewMinute onSuccess={onNewMinute} />}
    />
  );
};

export default MinutesHeader;
