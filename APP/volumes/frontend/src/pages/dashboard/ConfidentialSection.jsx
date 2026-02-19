/**
 * ConfidentialSection.jsx
 * Sección genérica para clientes o proyectos confidenciales.
 * Reutiliza ClientCard y ProjectCard existentes — sin nuevos componentes de card.
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import ClientCard from "@/pages/clientes/ClientCard";
import ProjectCard from "@/pages/project/ProjectCard";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY  = "text-gray-600 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";

const EmptyState = ({ icon, emptyMessage }) => (
  <div className="text-center py-10">
    <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
      <Icon name={icon} className={`${TXT_META} w-7 h-7`} />
    </div>
    <p className={`${TXT_META} text-sm`}>{emptyMessage || "Sin registros."}</p>
  </div>
);

const ConfidentialSection = ({
  type = "clients",       // "clients" | "projects"
  title,
  description,
  titleIcon,
  actionLabel,
  actionIcon = "FaKey",
  onAction,
  items = [],
  emptyMessage,
  // handlers propagados a las cards existentes
  onUpdate,               // ClientCard usa onUpdate
  onEdit,
  onDelete,
  clients = [],           // ProjectCard necesita la lista de clientes
}) => {
  const emptyIcon = type === "projects" ? "FaFolderOpen" : "FaUser";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className={`text-lg font-bold ${TXT_TITLE} flex items-center gap-2 transition-theme`}>
            <Icon name={titleIcon} className="text-primary-500 dark:text-primary-400 w-4 h-4" />
            {title}
          </h2>
          {description && (
            <p className={`text-sm ${TXT_BODY} mt-0.5 transition-theme`}>{description}</p>
          )}
        </div>

        {actionLabel && (
          <ActionButton
            label={actionLabel}
            variant="soft"
            size="sm"
            icon={<Icon name={actionIcon} />}
            onClick={onAction}
          />
        )}
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <EmptyState icon={emptyIcon} emptyMessage={emptyMessage} />
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {type === "clients"
            ? items.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))
            : items.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  clients={clients}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
        </div>
      )}
    </div>
  );
};

export default ConfidentialSection;