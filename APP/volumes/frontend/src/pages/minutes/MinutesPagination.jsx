// src/pages/minutes/components/MinutesPagination.jsx
import React from "react";
import Icon from "@/components/ui/icon/iconManager";

const TXT_META = "text-gray-500 dark:text-gray-400";

const MAX_VISIBLE_PAGES = 5;

/**
 * Calcula qué páginas mostrar con elipsis cuando hay muchas.
 * Ej: [1, '...', 4, 5, 6, '...', 20]
 */
const getPageRange = (current, total) => {
  if (total <= MAX_VISIBLE_PAGES) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const half  = Math.floor(MAX_VISIBLE_PAGES / 2);
  let start   = Math.max(2, current - half);
  let end     = Math.min(total - 1, current + half);

  if (current - half <= 2)        end   = Math.min(total - 1, MAX_VISIBLE_PAGES - 1);
  if (current + half >= total - 1) start = Math.max(2, total - MAX_VISIBLE_PAGES + 2);

  const pages = [1];
  if (start > 2)       pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);

  return pages;
};

/**
 * Props:
 *   currentPage  — página actual (1-indexed)
 *   totalPages   — total de páginas
 *   onPageChange(page) — callback
 */
const MinutesPagination = ({ currentPage, totalPages, onPageChange }) => {
  if (!totalPages || totalPages <= 1) return null;

  const pages = getPageRange(currentPage, totalPages);

  const btnBase = `min-w-[40px] px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center`;
  const btnNormal = `bg-surface shadow-card border border-secondary-200 dark:border-secondary-700 ${TXT_META} hover:bg-secondary-50 dark:hover:bg-secondary-800/50 hover:border-secondary-300 dark:hover:border-secondary-600 hover:text-gray-900 dark:hover:text-gray-50 transition-theme`;
  const btnActive = `bg-primary-500 border border-primary-500 text-white shadow-button hover:shadow-button-hover`;
  const btnDisabled = `bg-surface shadow-card border border-secondary-200 dark:border-secondary-700 ${TXT_META} opacity-50 cursor-not-allowed transition-theme`;

  return (
    <div className="flex justify-center items-center gap-2 py-8">
      {/* Anterior */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnNormal}`}
        aria-label="Página anterior"
      >
        <Icon name="chevronLeft" />
      </button>

      {/* Páginas */}
      {pages.map((page, idx) =>
        page === "..." ? (
          <span key={`ellipsis-${idx}`} className={`${btnBase} ${TXT_META} cursor-default select-none`}>
            …
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`${btnBase} ${page === currentPage ? btnActive : btnNormal}`}
            aria-label={`Ir a página ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        )
      )}

      {/* Siguiente */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${btnBase} ${currentPage === totalPages ? btnDisabled : btnNormal}`}
        aria-label="Página siguiente"
      >
        <Icon name="chevronRight" />
      </button>
    </div>
  );
};

export default MinutesPagination;