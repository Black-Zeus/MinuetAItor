import React from "react";

import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import SortableTableHeader from "@/components/common/SortableTableHeader";
import useTableSorting from "@/hooks/useTableSorting";
import ParticipantsViewActions from "./ParticipantsViewActions";

const ParticipantsTableView = ({ participants = [], hasFilters = false, onUpdated, onDeleted }) => {
  const { sortedItems, sortConfig, toggleSort } = useTableSorting(participants, {
    participant: (participant) => participant?.displayName,
    organization: (participant) => participant?.organization,
    email: (participant) => {
      const emails = Array.isArray(participant?.emails) ? participant.emails : [];
      return (emails.find((item) => item.isPrimary || item.is_primary) ?? emails[0] ?? null)?.email ?? null;
    },
    status: (participant) => participant?.isActive,
    emailsCount: (participant) => (Array.isArray(participant?.emails) ? participant.emails.length : 0),
  });

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
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/60">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3"><SortableTableHeader label="Participante" sortKey="participant" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Organización" sortKey="organization" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Correo principal" sortKey="email" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Estado" sortKey="status" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Correos" sortKey="emailsCount" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
            {sortedItems.map((participant) => {
              const primaryEmail = Array.isArray(participant.emails)
                ? participant.emails.find((item) => item.isPrimary || item.is_primary) ?? participant.emails[0] ?? null
                : null;

              return (
                <tr key={participant.id} className="align-top">
                  <td className="px-4 py-4">
                    <div className="min-w-[180px]">
                      <p className="font-semibold text-gray-900 dark:text-white">{participant.displayName ?? "—"}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{participant.title || "Sin cargo"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{participant.organization || "—"}</td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{primaryEmail?.email || "—"}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        participant.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {participant.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {Array.isArray(participant.emails) ? participant.emails.length : 0}
                  </td>
                  <td className="px-4 py-4">
                    <div className="min-w-[148px]">
                      <ParticipantsViewActions
                        id={participant.id}
                        summary={participant}
                        onUpdated={onUpdated}
                        onDeleted={onDeleted}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ParticipantsTableView;
