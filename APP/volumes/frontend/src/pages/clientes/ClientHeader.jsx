/**
 * ClientHeader.jsx
 */

import React from "react";
import ModuleHeader from "@/components/common/page/ModuleHeader";
import NewClient from "@/components/ui/button/NewClient";
import useSessionStore from "@/store/sessionStore";
import { canManageClients } from "@/utils/authz";

const ClientHeader = ({ onCreated }) => {          // ← recibe onCreated
  const authz = useSessionStore((s) => s.authz);
  const canCreateClient = canManageClients(authz);

  return (
    <ModuleHeader
      icon="FaBuilding"
      title="Gestión de Clientes"
      description="Administra y organiza tu cartera de clientes"
      actions={canCreateClient ? <NewClient onCreated={onCreated} /> : null}
    />
  );
};

export default ClientHeader;
