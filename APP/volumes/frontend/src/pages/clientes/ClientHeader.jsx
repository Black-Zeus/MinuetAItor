/**
 * ClientHeader.jsx
 */

import React from "react";
import ModuleHeader from "@/components/common/page/ModuleHeader";
import NewClient from "@/components/ui/button/NewClient";
import useSessionStore from "@/store/sessionStore";

const ClientHeader = ({ onCreated }) => {          // ← recibe onCreated
  const authz = useSessionStore((s) => s.authz);
  const canManageClients =
    Array.isArray(authz?.roles) && authz.roles.includes("ADMIN")
      ? true
      : Array.isArray(authz?.permissions) && authz.permissions.includes("clients.manage");

  return (
    <ModuleHeader
      icon="FaBuilding"
      title="Gestión de Clientes"
      description="Administra y organiza tu cartera de clientes"
      actions={canManageClients ? <NewClient onCreated={onCreated} /> : null}
    />
  );
};

export default ClientHeader;
