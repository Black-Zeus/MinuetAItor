import React from "react";

const buildVisiblePages = (page, totalPages) => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const normalizedStart = Math.max(1, end - 4);

  return Array.from(
    { length: end - normalizedStart + 1 },
    (_, index) => normalizedStart + index
  );
};

const pageButtonClassName = (isActive) => [
  "inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors",
  isActive
    ? "border-primary-700 bg-primary-700 text-white"
    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:bg-gray-800/70",
].join(" ");

const navButtonClassName =
  "inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:bg-gray-800/70";

const ReportPagination = ({
  page = 1,
  totalPages = 1,
  total = 0,
  itemsPerPage = 10,
  onPageChange,
  singularLabel = "registro",
  pluralLabel = "registros",
}) => {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const from = total === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
  const to = total === 0 ? 0 : Math.min(safePage * itemsPerPage, total);
  const pages = buildVisiblePages(safePage, safeTotalPages);
  const label = total === 1 ? singularLabel : pluralLabel;

  return (
    <div className="flex flex-col gap-4 border-t border-gray-200 pt-5 dark:border-gray-700 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Mostrando {from} a {to} de {total} {label}
      </p>

      <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
        <button
          type="button"
          onClick={() => onPageChange?.(safePage - 1)}
          disabled={safePage <= 1}
          className={navButtonClassName}
        >
          Anterior
        </button>

        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange?.(pageNumber)}
            className={pageButtonClassName(pageNumber === safePage)}
          >
            {pageNumber}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange?.(safePage + 1)}
          disabled={safePage >= safeTotalPages}
          className={navButtonClassName}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default ReportPagination;
