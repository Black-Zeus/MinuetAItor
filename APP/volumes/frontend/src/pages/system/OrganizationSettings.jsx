import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { OrganizationPanel } from "@/pages/system/SystemSettingsOrganizationPanel";
import { TXT_BODY, TXT_TITLE } from "@/pages/system/SystemSettingsShared";

const OrganizationSettings = () => {
  useDocumentTitle("Organización");

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className={`flex items-center gap-3 text-3xl font-bold ${TXT_TITLE}`}>
            <Icon name="FaBuilding" className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            Organización
          </h1>
          <p className={`mt-2 max-w-3xl text-sm ${TXT_BODY}`}>
            Administra la identidad institucional base de esta instancia para dejar preparada la estructura que luego
            podremos cablear hacia minutas, branding y trazabilidad.
          </p>
        </div>
      </div>

      <OrganizationPanel />
    </div>
  );
};

export default OrganizationSettings;
