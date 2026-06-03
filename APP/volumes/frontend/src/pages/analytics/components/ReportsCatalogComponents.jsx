import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import CollapsibleSection from "@/components/common/CollapsibleSection";
import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";

const buildDefaultOpenSections = (sections = []) =>
  Object.fromEntries(
    sections.map((section, index) => [section.id, index === 0])
  );

const ReportOpenAction = ({
  item,
  tooltip = "Abrir reporte",
  buttonClassName = "",
}) => {
  const navigate = useNavigate();

  return (
    <ActionButton
      variant="soft"
      size="xs"
      icon={<Icon name="fileLines" />}
      tooltip={tooltip}
      onClick={() => navigate(item.path)}
      className={buttonClassName}
    />
  );
};

export const ReportCard = ({ item }) => (
  <article className="group relative flex h-full flex-col justify-between rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-sky-500/60">
    <Link to={item.path} className="flex items-start gap-3">
      <div className="mt-0.5 rounded-2xl bg-sky-50 p-3 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
        <Icon name={item.icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 transition group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-300">
          {item.name}
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">
          {item.description || "Reporte del catálogo."}
        </p>
      </div>
    </Link>

    <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
      <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
        Acciones
      </div>
      <div className="grid grid-cols-1 place-items-center">
        <ReportOpenAction
          item={item}
          tooltip="Ver reporte"
          buttonClassName="w-full max-w-[72px]"
        />
      </div>
    </div>
  </article>
);

export const ReportListItem = ({ item }) => (
  <article className="group flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-sky-500/60 lg:flex-row lg:items-start lg:justify-between">
    <Link to={item.path} className="flex min-w-0 flex-1 items-start gap-4">
      <div className="mt-0.5 rounded-2xl bg-sky-50 p-3 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
        <Icon name={item.icon} className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-gray-900 transition group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-300">
          {item.name}
        </h3>

        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {item.description || "Reporte del catálogo."}
        </p>
      </div>
    </Link>

    <div className="w-full lg:w-20">
      <ReportOpenAction
        item={item}
        tooltip="Ver reporte"
        buttonClassName="w-full"
      />
    </div>
  </article>
);

export const ReportsTable = ({ items = [] }) => (
  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900/60">
          <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
            <th className="px-4 py-3">Reporte</th>
            <th className="px-4 py-3">Categoría</th>
            <th className="px-4 py-3">Finalidad</th>
            <th className="px-4 py-3">Acceso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="px-4 py-4">
                <Link
                  to={item.path}
                  className="group inline-flex min-w-[220px] items-start gap-3"
                >
                  <div className="mt-0.5 rounded-xl bg-sky-50 p-2.5 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                    <Icon name={item.icon} className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 transition group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-300">
                      {item.name}
                    </p>
                  </div>
                </Link>
              </td>
              <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                {item.sectionName || "Sin categoría"}
              </td>
              <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                {item.description || "Reporte del catálogo."}
              </td>
              <td className="px-4 py-4">
                <div className="min-w-[148px]">
                  <ReportOpenAction
                    item={item}
                    tooltip="Ver reporte"
                    buttonClassName="w-full"
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

export const BasePagination = ({ page, totalPages, onPageChange, total, itemsPerPage }) => {
  if (totalPages <= 1) return null;
  const from = (page - 1) * itemsPerPage + 1;
  const to = Math.min(page * itemsPerPage, total);

  return (
    <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Mostrando {from}-{to} de {total} reportes
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-700"
        >
          Anterior
        </button>
        <span className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-700"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export const HeaderSummaryTile = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-center dark:border-gray-700 dark:bg-slate-900/40">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {label}
    </p>
    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
      {value}
    </p>
    {helper ? (
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helper}</p>
    ) : null}
  </div>
);

export const FlatReportsContent = ({ items, viewMode, isAudit }) => {
  if (!items.length) {
    return (
      <CatalogEmptyState
        hasFilters={false}
        icon={isAudit ? "FaClipboardCheck" : "FaRegFile"}
        title={isAudit ? "No se encontraron reportes de auditoría" : "No se encontraron reportes de gestión"}
        defaultMessage="No hay reportes definidos para este catálogo."
      />
    );
  }

  if (viewMode === "list") {
    return (
      <div className="space-y-4">
        {items.map((item) => (
          <ReportListItem key={item.id} item={item} />
        ))}
      </div>
    );
  }

  if (viewMode === "table") {
    return <ReportsTable items={items} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
      {items.map((item) => (
        <ReportCard key={item.id} item={item} />
      ))}
    </div>
  );
};

export const ReportsGroupedByCategory = ({ sections = [], isAudit = false }) => {
  const [expandedByCategory, setExpandedByCategory] = useState(() =>
    buildDefaultOpenSections(sections)
  );

  useEffect(() => {
    setExpandedByCategory(buildDefaultOpenSections(sections));
  }, [sections]);

  if (!sections.length) {
    return (
      <CatalogEmptyState
        hasFilters={false}
        icon={isAudit ? "FaClipboardCheck" : "FaRegFile"}
        title={isAudit ? "No se encontraron categorías de auditoría" : "No se encontraron categorías de gestión"}
        defaultMessage="No hay categorías definidas para este catálogo."
      />
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <CollapsibleSection
          key={section.id}
          title={section.name}
          subtitle={section.description}
          icon={section.items[0]?.icon || "FaRegFile"}
          count={section.items.length}
          isOpen={expandedByCategory[section.id] ?? false}
          onToggle={() =>
            setExpandedByCategory((prev) => ({
              ...prev,
              [section.id]: !(prev[section.id] ?? false),
            }))
          }
        >
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {section.items.map((item) => (
              <ReportCard key={item.id} item={item} />
            ))}
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
};
