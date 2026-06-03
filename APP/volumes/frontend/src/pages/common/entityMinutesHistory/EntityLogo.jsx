import React, { useEffect, useState } from "react";

import Icon from "@/components/ui/icon/iconManager";

const EntityLogo = ({ entity, type }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [entity.logoUrl]);

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
      {entity.logoUrl && !failed ? (
        <img
          src={entity.logoUrl}
          alt={entity.name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon name={entity.icon || (type === "project" ? "FaFolderOpen" : "FaBuilding")} className="h-6 w-6" />
      )}
    </div>
  );
};

export default EntityLogo;
