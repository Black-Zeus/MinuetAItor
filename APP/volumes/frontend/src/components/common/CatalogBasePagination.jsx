import React from "react";

const CatalogBasePagination = ({
  page = 1,
  totalPages = 1,
  onPageChange,
  total = 0,
  itemsPerPage = 12,
  singularLabel = "registro",
  pluralLabel = "registros",
}) => {
  if (totalPages <= 1) return null;

  const from = (page - 1) * itemsPerPage + 1;
  const to = Math.min(page * itemsPerPage, total);
  const label = total === 1 ? singularLabel : pluralLabel;

  return (
    <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Mostrando {from}–{to} de {total} {label}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-700"
        >
          ← Anterior
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
          Siguiente →
        </button>
      </div>
    </div>
  );
};

export default CatalogBasePagination;
