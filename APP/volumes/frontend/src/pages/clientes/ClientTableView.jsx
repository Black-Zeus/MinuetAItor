import React from "react";

import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import SortableTableHeader from "@/components/common/SortableTableHeader";
import useTableSorting from "@/hooks/useTableSorting";
import ClientViewActions from "./ClientViewActions";
import { formatDate, parseAppDate } from "@/utils/formats";

const ClientTableView = ({ clients = [], hasFilters = false, onUpdate, onDelete }) => {
  const { sortedItems, sortConfig, toggleSort } = useTableSorting(clients, {
    client: (client) => client?.name,
    industry: (client) => client?.industry,
    email: (client) => client?.email,
    status: (client) => client?.isActive,
    createdAt: (client) => (client?.createdAt ? parseAppDate(client.createdAt).getTime() : null),
  });

  if (!clients.length) {
    return (
      <CatalogEmptyState
        hasFilters={hasFilters}
        icon="FaUsers"
        title="No se encontraron clientes"
        filteredMessage="Intenta ajustar los filtros."
        defaultMessage="Crea un nuevo cliente para comenzar."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/60">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3"><SortableTableHeader label="Cliente" sortKey="client" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Industria" sortKey="industry" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Correo" sortKey="email" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Estado" sortKey="status" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Alta" sortKey="createdAt" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
            {sortedItems.map((client) => (
              <tr key={client.id} className="align-top">
                <td className="px-4 py-4">
                  <div className="min-w-[220px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{client.name ?? "—"}</span>
                      {client.isConfidential ? (
                        <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-300">
                          Confidencial
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{client.description ?? "Sin descripción"}</p>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{client.industry ?? "—"}</td>
                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{client.email ?? "—"}</td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      client.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {client.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                  {client.createdAt ? formatDate(client.createdAt) : "—"}
                </td>
                <td className="px-4 py-4">
                  <div className="min-w-[148px]">
                    <ClientViewActions
                      id={client.id}
                      summary={client}
                      onUpdated={onUpdate}
                      onDeleted={onDelete}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientTableView;
