import React from "react";

import Icon from "@/components/ui/icon/iconManager";

const CatalogEmptyState = ({
  hasFilters = false,
  icon = "FaInbox",
  title = "Sin resultados",
  filteredMessage = "No se encontraron resultados con los filtros aplicados.",
  defaultMessage = "No hay registros disponibles todavía.",
}) => (
  <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center dark:border-gray-700">
    <Icon
      name={hasFilters ? "FaSearch" : icon}
      className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600"
    />
    <h3 className="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400">
      {hasFilters ? filteredMessage : defaultMessage}
    </p>
  </div>
);

export default CatalogEmptyState;
