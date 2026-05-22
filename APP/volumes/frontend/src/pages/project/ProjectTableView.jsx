import React from "react";

import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import SortableTableHeader from "@/components/common/SortableTableHeader";
import useTableSorting from "@/hooks/useTableSorting";
import ProjectViewActions from "./ProjectViewActions";

const ProjectTableView = ({
  projects = [],
  clientCatalog = [],
  hasFilters = false,
  onUpdated,
  onDeleted,
}) => {
  const { sortedItems, sortConfig, toggleSort } = useTableSorting(projects, {
    project: (project) => project?.name,
    client: (project) => project?.clientName ?? project?.client,
    code: (project) => project?.code,
    status: (project) => project?.isActive,
    autoSend: (project) => Number(Boolean(project?.autoSendOnPreview || project?.autoSendOnCompleted)),
  });

  if (!projects.length) {
    return (
      <CatalogEmptyState
        hasFilters={hasFilters}
        icon="FaFolder"
        title="No se encontraron proyectos"
        filteredMessage="Intenta ajustar los filtros."
        defaultMessage="Crea un nuevo proyecto para comenzar."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/60">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3"><SortableTableHeader label="Proyecto" sortKey="project" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Cliente" sortKey="client" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Código" sortKey="code" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Estado" sortKey="status" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3"><SortableTableHeader label="Autoenvío" sortKey="autoSend" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
            {sortedItems.map((project) => (
              <tr key={project.id} className="align-top">
                <td className="px-4 py-4">
                  <div className="min-w-[220px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{project.name ?? "—"}</span>
                      {project.isConfidential ? (
                        <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-300">
                          Confidencial
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{project.description ?? "Sin descripción"}</p>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                  {project.clientName ?? project.client ?? "—"}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{project.code ?? "—"}</td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      project.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {project.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                  {project.autoSendOnPreview || project.autoSendOnCompleted ? "Configurado" : "Manual"}
                </td>
                <td className="px-4 py-4">
                  <div className="min-w-[148px]">
                    <ProjectViewActions
                      id={project.id}
                      summary={project}
                      clientCatalog={clientCatalog}
                      onUpdated={onUpdated}
                      onDeleted={onDeleted}
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

export default ProjectTableView;
