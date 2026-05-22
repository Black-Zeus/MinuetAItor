import React, { useEffect, useMemo, useState } from "react";

import CollapsibleSection from "@/components/common/CollapsibleSection";
import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import ProjectCard from "./ProjectCard";

const groupProjectsByClient = (projects) => {
  const map = new Map();

  (projects ?? []).forEach((project) => {
    const key = String(project?.clientId ?? project?.client_id ?? project?.clientName ?? project?.client ?? "without-client");
    const label = String(project?.clientName ?? project?.client ?? "Sin cliente asignado");
    if (!map.has(key)) {
      map.set(key, { key, label, items: [] });
    }
    map.get(key).items.push(project);
  });

  return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label, "es"));
};

const ProjectsGroupedByClient = ({
  projects = [],
  clientCatalog = [],
  onUpdated,
  onDeleted,
  hasFilters = false,
}) => {
  const groups = useMemo(() => groupProjectsByClient(projects), [projects]);
  const [expandedByClient, setExpandedByClient] = useState({});

  useEffect(() => {
    setExpandedByClient((prev) => {
      const next = { ...prev };
      groups.forEach((group) => {
        if (typeof next[group.key] !== "boolean") {
          next[group.key] = true;
        }
      });
      return next;
    });
  }, [groups]);

  if (!groups.length) {
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
    <div className="space-y-6">
      {groups.map((group) => (
        <CollapsibleSection
          key={group.key}
          title={group.label}
          subtitle={group.items.length === 1 ? "1 proyecto asociado" : `${group.items.length} proyectos asociados`}
          icon="FaBuilding"
          count={group.items.length}
          isOpen={expandedByClient[group.key] ?? true}
          onToggle={() =>
            setExpandedByClient((prev) => ({ ...prev, [group.key]: !(prev[group.key] ?? true) }))
          }
          className="overflow-hidden shadow-card"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            {group.items.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                summary={project}
                clientCatalog={clientCatalog}
                onUpdated={onUpdated}
                onDeleted={onDeleted}
              />
            ))}
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
};

export default ProjectsGroupedByClient;
