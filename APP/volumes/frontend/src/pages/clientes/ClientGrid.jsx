/**
 * ClientGrid.jsx
 * Grid con dos secciones: normales y confidenciales (colapsables tipo acordeón)
 */

import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import CollapsibleSection from "@/components/common/CollapsibleSection";
import ClientCard from "./ClientCard";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META = "text-gray-500 dark:text-gray-400";

const EmptyState = ({ hasFilters, label }) => (
  <div className="text-center py-12 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
      <Icon name="FaUsers" className={`${TXT_META} w-8 h-8`} />
    </div>

    <h3 className={`text-lg font-medium ${TXT_TITLE} mb-2 transition-theme`}>
      {label || "No se encontraron clientes"}
    </h3>

    <p className={TXT_META}>
      {hasFilters ? "Intenta ajustar los filtros" : "Crea un nuevo cliente para comenzar"}
    </p>
  </div>
);

const Grid = ({ clients, onUpdate, onDelete }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {clients.map((client) => (
      <ClientCard
        key={client.id}
        id={client.id}
        summary={client}
        onUpdated={onUpdate}
        onDeleted={onDelete}
      />
    ))}
  </div>
);

const ClientGrid = ({
  clients = [],
  onUpdate,
  onDelete,
  hasFilters,
  canViewConfidential = true, // RBAC desde el padre
  defaultOpen = { normal: true, confidential: false }, // opcional
}) => {
  const { normalClients, confidentialClients } = useMemo(() => {
    const list = Array.isArray(clients) ? clients : [];
    const isConf = (c) => Boolean(c?.isConfidential); // ajusta si usas snake_case
    return {
      normalClients: list.filter((c) => !isConf(c)),
      confidentialClients: list.filter((c) => isConf(c)),
    };
  }, [clients]);

  const showConf = Boolean(canViewConfidential);

  const [openNormal, setOpenNormal] = useState(Boolean(defaultOpen?.normal));
  const [openConf, setOpenConf] = useState(Boolean(defaultOpen?.confidential));

  // Si no hay nada que mostrar
  if (normalClients.length === 0 && (!showConf || confidentialClients.length === 0)) {
    return <EmptyState hasFilters={hasFilters} />;
  }

  return (
    <div className="space-y-6">
      {/* Normales (colapsable) */}
      <CollapsibleSection
        title="Clientes"
        subtitle="Registros estándar"
        icon="FaUsers"
        count={normalClients.length}
        isOpen={openNormal}
        onToggle={() => setOpenNormal((v) => !v)}
      >
        {normalClients.length === 0 ? (
          <EmptyState hasFilters={hasFilters} label="No se encontraron clientes estándar" />
        ) : (
          <Grid clients={normalClients} onUpdate={onUpdate} onDelete={onDelete} />
        )}
      </CollapsibleSection>

      {/* Confidenciales (colapsable) */}
      {showConf ? (
        <CollapsibleSection
          title="Clientes confidenciales"
          subtitle="Acceso restringido"
          icon="FaLock" // cambia si no existe en tu IconManager
          count={confidentialClients.length}
          isOpen={openConf}
          onToggle={() => setOpenConf((v) => !v)}
        >
          {confidentialClients.length === 0 ? (
            <EmptyState hasFilters={hasFilters} label="No se encontraron clientes confidenciales" />
          ) : (
            <Grid clients={confidentialClients} onUpdate={onUpdate} onDelete={onDelete} />
          )}
        </CollapsibleSection>
      ) : null}
    </div>
  );
};

export default ClientGrid;
