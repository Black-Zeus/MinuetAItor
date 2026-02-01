import React from "react";
import { Icon } from "@components/ui/icon/iconManager";

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      // Mostrar todas las páginas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Mostrar páginas con "..."
      if (currentPage <= 3) {
        // Inicio: 1 2 3 4 ... 10
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Final: 1 ... 7 8 9 10
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        // Medio: 1 ... 4 5 6 ... 10
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-between border-t-2 border-gray-200 pt-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">
          Página <span className="font-medium">{currentPage}</span> de{" "}
          <span className="font-medium">{totalPages}</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Botón Anterior */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            currentPage === 1
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Icon name="chevronLeft" className="text-sm" />
          Anterior
        </button>

        {/* Números de página */}
        <div className="flex items-center gap-1">
          {pages.map((page, index) => {
            if (page === "...") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-3 py-2 text-gray-400"
                >
                  ...
                </span>
              );
            }

            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`w-10 h-10 rounded-lg font-medium transition-all ${
                  currentPage === page
                    ? "bg-blue-600 text-white"
                    : "bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Botón Siguiente */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            currentPage === totalPages
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Siguiente
          <Icon name="chevronRight" className="text-sm" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;