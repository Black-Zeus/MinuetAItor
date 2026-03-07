// src/pages/minutes/components/MinutesResults.jsx
import React from "react";
import Icon from "@/components/ui/icon/iconManager";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_META  = "text-gray-500 dark:text-gray-400";

/**
 * Props:
 *   count        — minutas en la página actual
 *   total        — total de minutas que coinciden con los filtros
 *   isRefreshing — muestra indicador de carga silenciosa
 *   currentPage  — página actual
 *   totalPages   — total de páginas
 *   pageSize     — items por página
 */
const MinutesResults = ({
  count        = 0,
  total        = 0,
  isRefreshing = false,
  currentPage  = 1,
  totalPages   = 1,
  pageSize     = 12,
}) => {
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to   = Math.min(currentPage * pageSize, total);

  return (
    <div className="flex justify-between items-center px-2 py-4 mb-4">
      <div className={`text-sm ${TXT_META} flex items-center gap-2 transition-theme`}>
        <Icon name="listCheck" />
        {total === 0 ? (
          <span>Sin resultados</span>
        ) : (
          <>
            Mostrando{" "}
            <strong className={`${TXT_TITLE} font-semibold transition-theme`}>
              {from}–{to}
            </strong>{" "}
            de{" "}
            <strong className={`${TXT_TITLE} font-semibold transition-theme`}>
              {total}
            </strong>{" "}
            {total === 1 ? "minuta" : "minutas"}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isRefreshing && (
          <div className={`text-xs ${TXT_META} flex items-center gap-1.5 transition-theme`}>
            <Icon name="spinner" className="animate-spin text-primary-500" />
            Actualizando…
          </div>
        )}
        {totalPages > 1 && (
          <span className={`text-xs ${TXT_META} transition-theme`}>
            Página {currentPage} / {totalPages}
          </span>
        )}
      </div>
    </div>
  );
};

export default MinutesResults;