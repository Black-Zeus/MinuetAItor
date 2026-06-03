import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import CatalogViewBar from "@/components/common/CatalogViewBar";
import ModuleHeader from "@/components/common/page/ModuleHeader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import useModuleViewMode from "@/hooks/useModuleViewMode";
import {
  AUDIT_REPORT_SECTIONS,
  GESTION_REPORT_SECTIONS,
} from "@config/sidebarConfig";
import {
  BasePagination,
  FlatReportsContent,
  HeaderSummaryTile,
  ReportsGroupedByCategory,
} from "./components/ReportsCatalogComponents";

const VIEW_OPTIONS = [
  { id: "base", label: "Base" },
  { id: "list", label: "Listado" },
  { id: "table", label: "Tabla" },
  { id: "category", label: "Por categoría" },
];

const DEFAULT_ITEMS_PER_PAGE = 18;
const TABLE_ITEMS_PER_PAGE = 100;

const ReportsCatalogPage = () => {
  const { pathname } = useLocation();
  const isAudit = pathname.startsWith("/reports/audit");
  const sections = isAudit ? AUDIT_REPORT_SECTIONS : GESTION_REPORT_SECTIONS;
  const [viewMode, setViewMode] = useModuleViewMode(["base", "list", "table", "category"]);
  const [page, setPage] = useState(1);
  const itemsPerPage = viewMode === "table" ? TABLE_ITEMS_PER_PAGE : DEFAULT_ITEMS_PER_PAGE;

  const pageTitle = isAudit ? "Reportería de Auditoría" : "Reportería de Gestión";
  const pageDescription = isAudit
    ? "Accede a los reportes de control, trazabilidad y auditoría de la plataforma."
    : "Explora el catálogo de reportes administrativos, operacionales y ejecutivos del sistema para navegar al reporte que necesites.";

  useDocumentTitle(pageTitle);

  const totalReports = useMemo(
    () => sections.reduce((acc, section) => acc + section.items.length, 0),
    [sections]
  );
  const flatItems = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections]
  );
  const totalPages = Math.max(1, Math.ceil(flatItems.length / itemsPerPage));
  const paginatedItems = useMemo(
    () => flatItems.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [flatItems, itemsPerPage, page]
  );

  useEffect(() => {
    setPage(1);
  }, [pathname]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handlePageChange = (nextPage) => {
    if (nextPage >= 1 && nextPage <= totalPages) {
      setPage(nextPage);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <ModuleHeader
        icon={isAudit ? "FaClipboardCheck" : "FaRegFile"}
        title={pageTitle}
        description={pageDescription}
      />

      <div className="rounded-[26px] border border-gray-200/80 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {isAudit ? "Catálogo de auditoría" : "Catálogo de gestión"}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
              Reportes disponibles para navegación
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Cada bloque puede expandirse o contraerse para revisar la cobertura del catálogo y entrar al reporte que necesites.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px] sm:grid-cols-2">
            <HeaderSummaryTile label="Secciones" value={sections.length} />
            <HeaderSummaryTile label="Reportes" value={totalReports} />
          </div>
        </div>

        <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700">
          <CatalogViewBar
            count={totalReports}
            singularLabel="reporte"
            pluralLabel="reportes"
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            options={VIEW_OPTIONS}
          />
        </div>
      </div>

      {viewMode === "category" ? (
        <ReportsGroupedByCategory sections={sections} isAudit={isAudit} />
      ) : (
        <FlatReportsContent items={paginatedItems} viewMode={viewMode} isAudit={isAudit} />
      )}

      {viewMode !== "category" && totalPages > 1 ? (
        <BasePagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          total={flatItems.length}
          itemsPerPage={itemsPerPage}
        />
      ) : null}
    </div>
  );
};

export default ReportsCatalogPage;
