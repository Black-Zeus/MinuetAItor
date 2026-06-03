import React from "react";

import Icon from "@/components/ui/icon/iconManager";
import CatalogEmptyState from "@/components/common/CatalogEmptyState";
import SortableTableHeader from "@/components/common/SortableTableHeader";
import { openPdfViewer } from "@/components/ui/pdf/PdfViewerModal";
import { formatDateMedium } from "@/utils/formats";
import useTableSorting from "@/hooks/useTableSorting";
import {
  buildMinuteFilename,
  getMinuteStatusConfig,
} from "@/pages/minutes/MinuteCard";
import { TXT_BODY, TXT_HEAD, TXT_META, TXT_TITLE } from "./constants";
import HistoryActionButton from "./HistoryActionButton";
import { cn, getMinutePdfState } from "./utils";

const HistoryTable = ({ minutes = [], type, navigate, hasFilters = false }) => {
  const { sortedItems, sortConfig, toggleSort } = useTableSorting(minutes, {
    client: (minute) => minute?.client,
    project: (minute) => minute?.project,
    minute: (minute) => minute?.title,
    date: (minute) => minute?.date,
    status: (minute) => minute?.status,
    preparedBy: (minute) => minute?.preparedBy,
  });

  if (!minutes.length) {
    return (
      <CatalogEmptyState
        hasFilters={hasFilters}
        icon="fileLines"
        title="Sin minutas asociadas"
        filteredMessage="Ninguna minuta coincide con los filtros aplicados."
        defaultMessage="Esta entidad aún no tiene minutas registradas."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-theme dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/60">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
              {type === "participant" || type === "all" ? (
                <th className={`px-4 py-3 ${TXT_HEAD}`}>
                  <SortableTableHeader label="Cliente" sortKey="client" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} />
                </th>
              ) : null}
              {type === "client" || type === "participant" || type === "all" ? (
                <th className={`px-4 py-3 ${TXT_HEAD}`}>
                  <SortableTableHeader label="Proyecto" sortKey="project" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} />
                </th>
              ) : null}
              <th className={`px-4 py-3 ${TXT_HEAD}`}>
                <SortableTableHeader label="Minuta" sortKey="minute" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} />
              </th>
              <th className={`px-4 py-3 ${TXT_HEAD}`}>
                <SortableTableHeader label="Fecha" sortKey="date" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} />
              </th>
              <th className={`px-4 py-3 ${TXT_HEAD}`}>
                <SortableTableHeader label="Estado" sortKey="status" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} />
              </th>
              <th className={`px-4 py-3 ${TXT_HEAD}`}>
                <SortableTableHeader label="Metadatos" sortKey="preparedBy" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} />
              </th>
              <th className={`px-4 py-3 text-right ${TXT_HEAD}`}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80">
            {sortedItems.map((minute) => {
              const statusConfig = getMinuteStatusConfig(minute);
              const pdfState = getMinutePdfState(minute);
              const filename = buildMinuteFilename(minute?.title, minute?.date);

              const openMinute = () => {
                if (!minute?.id) return;
                navigate(`/minutes/process/${minute.id}`);
              };

              const openPdf = () => {
                if (!minute?.id || pdfState.disabled) return;
                openPdfViewer({
                  recordId: minute.id,
                  pdfType: pdfState.type,
                  filename,
                  title: `PDF — ${minute?.title || "Minuta"}`,
                });
              };

              return (
                <tr
                  key={minute.id}
                  className="border-b border-slate-200/80 align-top last:border-0 hover:bg-slate-50/70 dark:border-slate-700/60 dark:hover:bg-slate-800/30"
                >
                  {type === "participant" || type === "all" ? (
                    <td className={`px-4 py-4 ${TXT_BODY}`}>
                      <div className="min-w-[160px]">{minute?.client || "Sin cliente"}</div>
                    </td>
                  ) : null}
                  {type === "client" || type === "participant" || type === "all" ? (
                    <td className={`px-4 py-4 ${TXT_BODY}`}>
                      <div className="min-w-[160px]">{minute?.project || "Sin proyecto"}</div>
                    </td>
                  ) : null}
                  <td className="px-4 py-4">
                    <div className="min-w-[240px]">
                      <p className={TXT_TITLE}>{minute?.title || "Minuta sin título"}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                        {minute?.summary || "Sin resumen disponible"}
                      </p>
                    </div>
                  </td>
                  <td className={`px-4 py-4 ${TXT_BODY}`}>
                    <div>{minute?.date ? formatDateMedium(minute.date) : "-"}</div>
                    <div className={cn("mt-1", TXT_META)}>{[minute?.time, minute?.duration].filter(Boolean).join(" · ") || "Sin horario"}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusConfig.className}`}>
                      <Icon name={statusConfig.icon} className={statusConfig.icon === "spinner" ? "animate-spin text-[11px]" : "text-[11px]"} />
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className={`px-4 py-4 ${TXT_BODY}`}>
                    <div>{minute?.preparedBy || "Sin elaborador"}</div>
                    <div className={cn("mt-1", TXT_META)}>
                      {Array.isArray(minute?.participants) && minute.participants.length
                        ? `${minute.participants.length} participantes`
                        : "Sin participantes"}
                    </div>
                    {Number(minute?.totalTokens || 0) > 0 ? (
                      <div className={cn("mt-1", TXT_META)}>{minute.totalTokens} tokens</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-[170px] justify-end gap-2">
                      <HistoryActionButton icon="eye" label="Ver" onClick={openMinute} />
                      <HistoryActionButton
                        icon="fileLines"
                        label={pdfState.label}
                        onClick={openPdf}
                        tone="success"
                        disabled={pdfState.disabled}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryTable;
