/**
 * ClientGrid.jsx
 * Grid con dos secciones: normales y confidenciales (colapsables tipo acordeón)
 */

import React, { useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
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

/**
 * Panel colapsable (acordeón)
 * - Header clickeable
 * - Contenido se muestra/oculta
 */
const CollapsibleSection = ({
  title,
  subtitle,
  icon,
  count,
  isOpen,
  onToggle,
  children,
}) => {
  // Usa chevrons si existen; si no, no rompe (IconManager podría warn si no está)
  const ChevronIcon = isOpen ? "FaChevronUp" : "FaChevronDown";

  return (
    <section className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 transition-theme">
      <button
        type="button"
        onClick={onToggle}
        className="
          w-full flex items-center justify-between gap-4
          px-5 py-4
          hover:bg-gray-50 dark:hover:bg-gray-700/40
          rounded-xl
          transition-theme
        "
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex-shrink-0">
            <Icon name={icon} className={`${TXT_META} w-5 h-5`} />
          </div>

          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className={`text-base font-semibold ${TXT_TITLE} truncate transition-theme`}>
                {title}
              </h3>

              {Number.isFinite(count) ? (
                <span
                  className="
                    px-2 py-0.5 rounded-full text-xs font-medium
                    bg-gray-100 dark:bg-gray-700
                    text-gray-700 dark:text-gray-200
                    flex-shrink-0
                  "
                  title="Cantidad"
                >
                  {count}
                </span>
              ) : null}
            </div>

            {subtitle ? (
              <p className={`${TXT_META} text-sm truncate`}>{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Fallback: si el icono no existe, al menos muestra texto */}
          <span className={`${TXT_META} text-xs`}>{isOpen ? "Ocultar" : "Mostrar"}</span>
          <Icon name={ChevronIcon} className={`${TXT_META} w-4 h-4`} />
        </div>
      </button>

      {isOpen ? (
        <div className="px-5 pb-5 pt-1">
          {children}
        </div>
      ) : null}
    </section>
  );
};

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