import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import ProjectViewActions from "./ProjectViewActions";

const ProjectListView = ({
  projects = [],
  clientCatalog = [],
  hasFilters = false,
  onUpdated,
  onDeleted,
}) => {
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
    <div className="space-y-4">
      {projects.map((project) => (
        <article
          key={project.id}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-theme dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{project.name ?? "—"}</h3>
                {project.isConfidential ? (
                  <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-300">
                    Confidencial
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    project.isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {project.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{project.description ?? "Sin descripción"}</p>

              <div className="mt-4 grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Icon name="FaBuilding" className="h-4 w-4 text-gray-400" />
                  <span>{project.clientName ?? project.client ?? "Sin cliente"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="FaTag" className="h-4 w-4 text-gray-400" />
                  <span>{project.code ?? "Sin código"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="FaEnvelope" className="h-4 w-4 text-gray-400" />
                  <span>
                    {project.autoSendOnCompleted ? "Autoenvío publicación activo" : "Autoenvío publicación inactivo"}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-48">
              <ProjectViewActions
                id={project.id}
                summary={project}
                clientCatalog={clientCatalog}
                onUpdated={onUpdated}
                onDeleted={onDeleted}
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};

export default ProjectListView;
