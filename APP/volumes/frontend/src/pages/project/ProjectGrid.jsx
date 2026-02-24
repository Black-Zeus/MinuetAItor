/**
 * ProjectGrid.jsx
 * Grid de proyectos con dos zonas colapsables: Normal y Confidencial.
 * Mismo patrón que ClientGrid.jsx
 */

import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/icon/iconManager';
import ProjectCard from './ProjectCard';

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META  = "text-gray-500 dark:text-gray-400";

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ hasFilters, label }) => (
  <div className="text-center py-12 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
      <Icon name="FaFolder" className={`${TXT_META} w-8 h-8`} />
    </div>
    <h3 className={`text-lg font-medium ${TXT_TITLE} mb-2 transition-theme`}>
      {label ?? 'No se encontraron proyectos'}
    </h3>
    <p className={`${TXT_META} text-sm`}>
      {hasFilters ? 'Intenta ajustar los filtros' : 'Crea un nuevo proyecto para comenzar'}
    </p>
  </div>
);

// ─── Grid interno ─────────────────────────────────────────────────────────────

const Grid = ({ projects, clientCatalog, onUpdated, onDeleted }) => (
  <div className="grid grid-cols-3 gap-6">
    {projects.map((project) => (
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
);

// ─── Sección colapsable ───────────────────────────────────────────────────────

const CollapsibleSection = ({
  title,
  subtitle,
  icon,
  count,
  isOpen,
  onToggle,
  children,
}) => {
  const ChevronIcon = isOpen ? 'FaChevronUp' : 'FaChevronDown';

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-secondary-200 dark:border-secondary-700 shadow-sm transition-theme overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="
          w-full flex items-center justify-between
          px-5 py-4
          hover:bg-gray-50 dark:hover:bg-gray-700/40
          transition-colors text-left
        "
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex-shrink-0">
            <Icon name={icon} className="text-primary-500 dark:text-primary-400 w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className={`flex items-center gap-2 font-semibold ${TXT_TITLE} transition-theme`}>
              <span className="truncate">{title}</span>
              {count != null ? (
                <span className="
                  px-2 py-0.5 rounded-full text-xs font-medium
                  bg-gray-100 dark:bg-gray-700
                  text-gray-700 dark:text-gray-200
                  flex-shrink-0
                ">
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
          <span className={`${TXT_META} text-xs`}>{isOpen ? 'Ocultar' : 'Mostrar'}</span>
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

// ─── ProjectGrid ──────────────────────────────────────────────────────────────

const ProjectGrid = ({
  projects = [],
  clientCatalog = [],
  onUpdated,
  onDeleted,
  hasFilters,
  canViewConfidential = true,
  defaultOpen = { normal: true, confidential: false },
}) => {
  const { normalProjects, confidentialProjects } = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    const isConf = (p) => Boolean(p?.isConfidential ?? p?.is_confidential);
    return {
      normalProjects:       list.filter((p) => !isConf(p)),
      confidentialProjects: list.filter((p) =>  isConf(p)),
    };
  }, [projects]);

  const showConf = Boolean(canViewConfidential);

  const [openNormal, setOpenNormal] = useState(Boolean(defaultOpen?.normal));
  const [openConf,   setOpenConf]   = useState(Boolean(defaultOpen?.confidential));

  return (
    <div className="space-y-6">

      {/* ── Proyectos normales ── */}
      <CollapsibleSection
        title="Proyectos"
        subtitle="Registros estándar"
        icon="FaFolder"
        count={normalProjects.length}
        isOpen={openNormal}
        onToggle={() => setOpenNormal((v) => !v)}
      >
        {normalProjects.length === 0 ? (
          <EmptyState hasFilters={hasFilters} label="No se encontraron proyectos estándar" />
        ) : (
          <Grid
            projects={normalProjects}
            clientCatalog={clientCatalog}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
          />
        )}
      </CollapsibleSection>

      {/* ── Proyectos confidenciales ── */}
      {showConf ? (
        <CollapsibleSection
          title="Proyectos confidenciales"
          subtitle="Acceso restringido"
          icon="FaLock"
          count={confidentialProjects.length}
          isOpen={openConf}
          onToggle={() => setOpenConf((v) => !v)}
        >
          {confidentialProjects.length === 0 ? (
            <EmptyState hasFilters={hasFilters} label="No se encontraron proyectos confidenciales" />
          ) : (
            <Grid
              projects={confidentialProjects}
              clientCatalog={clientCatalog}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
            />
          )}
        </CollapsibleSection>
      ) : null}

    </div>
  );
};

export default ProjectGrid;