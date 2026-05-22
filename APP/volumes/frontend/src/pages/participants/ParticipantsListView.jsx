import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import ParticipantsViewActions from "./ParticipantsViewActions";

const ParticipantsListView = ({ participants = [], hasFilters = false, onUpdated, onDeleted }) => {
  if (!participants.length) {
    return (
      <CatalogEmptyState
        hasFilters={hasFilters}
        icon="FaUsers"
        title="Sin participantes registrados"
        filteredMessage="Ningún participante coincide con los filtros aplicados."
        defaultMessage="Crea el primer participante del catálogo para comenzar."
      />
    );
  }

  return (
    <div className="space-y-4">
      {participants.map((participant) => {
        const primaryEmail = Array.isArray(participant.emails)
          ? participant.emails.find((item) => item.isPrimary || item.is_primary) ?? participant.emails[0] ?? null
          : null;

        return (
          <article
            key={participant.id}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-theme dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{participant.displayName ?? "—"}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      participant.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {participant.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{participant.title || "Sin cargo"}</p>

                <div className="mt-4 grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Icon name="FaBuilding" className="h-4 w-4 text-gray-400" />
                    <span>{participant.organization || "Sin organización"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="FaEnvelope" className="h-4 w-4 text-gray-400" />
                    <span>{primaryEmail?.email || "Sin correo"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="FaUser" className="h-4 w-4 text-gray-400" />
                    <span>{Array.isArray(participant.emails) ? participant.emails.length : 0} correo(s)</span>
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-48">
                <ParticipantsViewActions
                  id={participant.id}
                  summary={participant}
                  onUpdated={onUpdated}
                  onDeleted={onDeleted}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default ParticipantsListView;
