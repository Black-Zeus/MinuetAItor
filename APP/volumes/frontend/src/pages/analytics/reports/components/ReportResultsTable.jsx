import React from "react";

import SortableTableHeader from "@/components/common/SortableTableHeader";

const HEAD_CELL =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400";

const BODY_CELL = "px-4 py-4 text-sm text-gray-700 dark:text-gray-300";

const ReportResultsTable = ({
  columns = [],
  rows = [],
  getRowKey,
  sortConfig = null,
  onSort,
  emptyTitle = "Sin registros para mostrar",
  emptyMessage = "Ajusta los filtros o ejecuta nuevamente el reporte.",
}) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/30">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-slate-900/60">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${HEAD_CELL} ${column.headerClassName ?? ""}`.trim()}
                >
                  {column.sortable ? (
                    <SortableTableHeader
                      label={column.label}
                      sortKey={column.sortKey ?? column.key}
                      activeSortKey={sortConfig?.key}
                      direction={sortConfig?.direction}
                      onSort={onSort}
                    />
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(columns.length, 1)}
                  className="px-6 py-12 text-center"
                >
                  <p className="text-base font-semibold text-gray-900 dark:text-white">
                    {emptyTitle}
                  </p>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {emptyMessage}
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={getRowKey?.(row, rowIndex) ?? row?.id ?? rowIndex}
                  className="border-b border-gray-100 align-top transition-colors hover:bg-gray-50/80 dark:border-gray-700/70 dark:hover:bg-slate-800/30"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`${BODY_CELL} ${column.cellClassName ?? ""}`.trim()}
                    >
                      {column.render ? column.render(row) : row?.[column.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportResultsTable;
