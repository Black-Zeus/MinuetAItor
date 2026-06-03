import React from "react";
import { useNavigate } from "react-router-dom";

import Icon from "@/components/ui/icon/iconManager";
import { openPdfViewer } from "@/components/ui/pdf/PdfViewerModal";
import { formatDateMedium } from "@/utils/formats";
import {
  buildMinuteFilename,
  getMinuteStatusConfig,
} from "@/pages/minutes/MinuteCard";
import HistoryActionButton from "./HistoryActionButton";
import HistoryEmptyState from "./HistoryEmptyState";
import HistoryNoFilterResults from "./HistoryNoFilterResults";
import { getMinutePdfState } from "./utils";

const HistoryListView = ({ minutes = [], type, hasFilters = false }) => {
  const navigate = useNavigate();

  if (!minutes.length) {
    return hasFilters ? <HistoryNoFilterResults /> : <HistoryEmptyState type={type} />;
  }

  return (
    <div className="space-y-4">
      {minutes.map((minute) => {
        const statusConfig = getMinuteStatusConfig(minute);
        const pdfState = getMinutePdfState(minute);
        const filename = buildMinuteFilename(minute?.title, minute?.date);

        const openMinute = () => {
          if (minute?.id) navigate(`/minutes/process/${minute.id}`);
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
          <article
            key={minute.id}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-theme dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {minute?.title || "Minuta sin título"}
                  </h3>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusConfig.className}`}>
                    <Icon name={statusConfig.icon} className={statusConfig.icon === "spinner" ? "animate-spin text-[11px]" : "text-[11px]"} />
                    {statusConfig.label}
                  </span>
                </div>

                <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                  {minute?.summary || "Sin resumen disponible"}
                </p>

                <div className="mt-4 grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-4">
                  {type === "participant" || type === "all" ? (
                    <div className="flex items-center gap-2">
                      <Icon name="FaBuilding" className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{minute?.client || "Sin cliente"}</span>
                    </div>
                  ) : null}
                  {type === "client" || type === "participant" || type === "all" ? (
                    <div className="flex items-center gap-2">
                      <Icon name="FaFolderOpen" className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{minute?.project || "Sin proyecto"}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Icon name="FaCalendar" className="h-4 w-4 text-gray-400" />
                    <span>{minute?.date ? formatDateMedium(minute.date) : "-"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="FaUser" className="h-4 w-4 text-gray-400" />
                    <span>{minute?.preparedBy || "Sin elaborador"}</span>
                  </div>
                </div>
              </div>

              <div className="flex w-full justify-end gap-2 lg:w-64">
                <HistoryActionButton icon="eye" label="Ver" onClick={openMinute} />
                <HistoryActionButton
                  icon="fileLines"
                  label={pdfState.label}
                  onClick={openPdf}
                  tone="success"
                  disabled={pdfState.disabled}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default HistoryListView;
