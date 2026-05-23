import React, { useEffect, useMemo, useState } from "react";

import ModuleHeader from "@/components/common/page/ModuleHeader";
import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";

import ReportPagination from "./ReportPagination";
import ReportResultsTable from "./ReportResultsTable";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_META = "text-gray-500 dark:text-gray-400";

const ReportFilterDropdown = ({
  filterFields = [],
  visibleFilters = {},
  onToggleVisibility,
  onClose,
}) => (
  <>
    <div className="fixed inset-0 z-40" onClick={onClose} />
    <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 border border-secondary-200 dark:border-secondary-700 rounded-2xl shadow-dropdown p-4 min-w-[250px] z-50 transition-theme">
      {filterFields.map((field) => (
        <div
          key={field.name}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary-50 dark:hover:bg-gray-700/50 cursor-pointer transition-theme"
          onClick={() => onToggleVisibility?.(field.name)}
        >
          <input
            type="checkbox"
            checked={Boolean(visibleFilters?.[field.name])}
            onChange={() => {}}
            className="w-4 h-4 cursor-pointer accent-primary-500"
          />
          <label
            className={`cursor-pointer text-sm ${TXT_TITLE} flex-1 transition-theme`}
          >
            {field.label}
          </label>
        </div>
      ))}
    </div>
  </>
);

const FilterField = ({
  type,
  label,
  icon,
  value,
  onChange,
  placeholder,
  options = [],
  getOptionValue,
  getOptionLabel,
}) => (
  <div className="flex flex-col gap-2">
    <label
      className={`flex items-center gap-2 text-sm font-semibold ${TXT_META} transition-theme`}
    >
      <Icon
        name={icon}
        className="text-primary-500 dark:text-primary-400 text-sm"
      />
      {label}
    </label>

    {type === "date" ? (
      <input
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        className={`w-full px-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
      />
    ) : type === "select" ? (
      <select
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        className={`w-full px-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
      >
        <option value="">{placeholder ?? "Seleccionar"}</option>
        {options.map((option, index) => {
          const optionValue = getOptionValue ? getOptionValue(option) : option?.value;
          const optionLabel = getOptionLabel ? getOptionLabel(option) : option?.label;

          return (
            <option key={String(optionValue ?? index)} value={String(optionValue ?? "")}>
              {String(optionLabel ?? "—")}
            </option>
          );
        })}
      </select>
    ) : (
      <div className="relative">
        <Icon
          name="FaSearch"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
        />
        <input
          type="text"
          value={value ?? ""}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder ?? ""}
          className={`w-full pl-10 pr-4 py-2.5 border border-secondary-200 dark:border-secondary-700 rounded-xl bg-white dark:bg-gray-800 ${TXT_TITLE} text-sm placeholder-gray-400 dark:placeholder:text-secondary-500 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-theme hover:border-secondary-300 dark:hover:border-secondary-600`}
        />
      </div>
    )}
  </div>
);

const SummaryCard = ({ label, value, helper, icon, tone = "sky" }) => {
  const toneMap = {
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  };

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {helper ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {helper}
            </p>
          ) : null}
        </div>

        {icon ? (
          <div className={`rounded-2xl p-3 ${toneMap[tone] ?? toneMap.sky}`}>
            <Icon name={icon} className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </article>
  );
};

const ReportModulePage = ({
  icon = "gauge",
  title,
  description,
  filterFields = [],
  defaultVisibleFilters = null,
  filterValues = {},
  onFilterChange,
  onApplyFilters,
  isApplyDisabled = false,
  applyLabel = "Filtrar / Ejecutar",
  resultsTitle = "Resultados del reporte",
  onExportPdf,
  onExportSpreadsheet,
  exportSpreadsheetLabel = "Exportar CSV / Excel",
  isExportDisabled = false,
  summaryCards = [],
  afterSummaryContent = null,
  columns = [],
  rows = [],
  getRowKey,
  sortConfig,
  onSort,
  page = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  emptyTitle,
  emptyMessage,
  children,
}) => {
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);
  const [visibleFilters, setVisibleFilters] = useState(() => {
    const defaultMap =
      defaultVisibleFilters && typeof defaultVisibleFilters === "object"
        ? defaultVisibleFilters
        : null;

    return Object.fromEntries(
      filterFields.map((field) => [
        field.name,
        defaultMap?.[field.name] ?? true,
      ])
    );
  });

  useEffect(() => {
    setVisibleFilters((current) => {
      const next = {};
      filterFields.forEach((field) => {
        next[field.name] =
          current?.[field.name] ??
          defaultVisibleFilters?.[field.name] ??
          true;
      });
      return next;
    });
  }, [defaultVisibleFilters, filterFields]);

  const activeFiltersCount = useMemo(
    () =>
      Object.values(filterValues ?? {}).filter(
        (value) => String(value ?? "").trim() !== ""
      ).length,
    [filterValues]
  );

  const toggleFilterVisibility = (filterName) => {
    setVisibleFilters((current) => ({
      ...current,
      [filterName]: !current?.[filterName],
    }));
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={icon}
        title={title}
        description={description}
        iconClassName="text-sky-600 dark:text-sky-300"
      />

      <section className="bg-surface shadow-card rounded-2xl p-6 border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 transition-theme">
        <div className="flex justify-between items-center pb-4 border-b border-secondary-200 dark:border-secondary-700/60 transition-theme">
          <button
            type="button"
            onClick={() => setFiltersExpanded((current) => !current)}
            className={`flex items-center gap-2 text-base font-semibold ${TXT_TITLE} hover:text-primary-600 dark:hover:text-primary-400 transition-theme`}
          >
            <Icon
              name="FaFilter"
              className="text-primary-500 dark:text-primary-400"
            />
            Filtros Activos
            {activeFiltersCount > 0 ? (
              <span className="ml-1 px-2.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-xs font-semibold transition-theme">
                {activeFiltersCount}
              </span>
            ) : null}
            <Icon
              name={filtersExpanded ? "FaChevronUp" : "FaChevronDown"}
              className="text-sm transition-transform duration-200"
            />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFiltersDropdown((current) => !current)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${TXT_META} bg-transparent border border-secondary-200 dark:border-secondary-700 rounded-xl hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:border-secondary-300 dark:hover:border-secondary-600 hover:text-gray-900 dark:hover:text-gray-50 transition-theme`}
            >
              <Icon name="FaSliders" className="text-sm" />
              Gestionar Filtros
            </button>

            {showFiltersDropdown ? (
              <ReportFilterDropdown
                filterFields={filterFields}
                visibleFilters={visibleFilters}
                onToggleVisibility={toggleFilterVisibility}
                onClose={() => setShowFiltersDropdown(false)}
              />
            ) : null}
          </div>
        </div>

        {filtersExpanded ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end mt-6">
            {filterFields.map((field) => (
              visibleFilters?.[field.name] ? (
                <div
                  key={field.name}
                  className={field.type === "text" ? "lg:col-span-1" : ""}
                >
                  <FilterField
                    type={field.type}
                    label={field.label}
                    icon={
                      field.icon ??
                      (field.type === "date" ? "FaCalendarAlt" : "FaSearch")
                    }
                    value={filterValues?.[field.name] ?? ""}
                  onChange={(value) => onFilterChange?.(field.name, value)}
                  placeholder={field.placeholder}
                  options={field.options}
                  getOptionValue={field.getOptionValue}
                  getOptionLabel={field.getOptionLabel}
                />
              </div>
            ) : null
            ))}

            <div className="flex flex-col gap-2 lg:col-start-6">
              <ActionButton
                label={applyLabel}
                icon={<Icon name="FaFilter" />}
                onClick={onApplyFilters}
                disabled={isApplyDisabled}
                className="w-full"
                size="sm"
              />
            </div>
          </div>
        ) : null}
      </section>

      {summaryCards.length ? (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </section>
      ) : null}

      {afterSummaryContent}

      <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/70">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {resultsTitle}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Ordena columnas, exporta resultados y navega por páginas sin salir del reporte.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ActionButton
              label="Exportar PDF"
              variant="danger"
              icon={<Icon name="fileLines" />}
              onClick={onExportPdf}
              disabled={isExportDisabled}
            />
            <ActionButton
              label={exportSpreadsheetLabel}
              variant="success"
              icon={<Icon name="download" />}
              onClick={onExportSpreadsheet}
              disabled={isExportDisabled}
            />
          </div>
        </div>

        {children}

        <ReportResultsTable
          columns={columns}
          rows={rows}
          getRowKey={getRowKey}
          sortConfig={sortConfig}
          onSort={onSort}
          emptyTitle={emptyTitle}
          emptyMessage={emptyMessage}
        />

        <div className="mt-5">
          <ReportPagination
            page={page}
            totalPages={totalPages}
            total={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={onPageChange}
          />
        </div>
      </section>
    </div>
  );
};

export default ReportModulePage;
