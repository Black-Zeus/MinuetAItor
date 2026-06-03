import React from "react";
import { useNavigate } from "react-router-dom";

import Icon from "@/components/ui/icon/iconManager";
import { openPdfViewer } from "@/components/ui/pdf/PdfViewerModal";
import { formatDateMedium } from "@/utils/formats";
import {
  buildMinuteFilename,
  getMinuteStatusConfig,
} from "@/pages/minutes/MinuteCard";
import HistoryEmptyState from "./HistoryEmptyState";
import HistoryNoFilterResults from "./HistoryNoFilterResults";
import HistoryActionButton from "./HistoryActionButton";
import { getMinutePdfState } from "./utils";

const HistoryCardView = ({ minutes = [], type, hasFilters = false }) => {
  const navigate = useNavigate();

  if (!minutes.length) {
    return hasFilters ? <HistoryNoFilterResults /> : <HistoryEmptyState type={type} />;
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
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
            className="flex h-full min-h-[218px] flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-theme dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex h-full flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                      {minute?.title || "Minuta sin título"}
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusConfig.className}`}>
                      <Icon name={statusConfig.icon} className={statusConfig.icon === "spinner" ? "animate-spin text-[11px]" : "text-[11px]"} />
                      {statusConfig.label}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                    {minute?.summary || "Sin resumen disponible"}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-3">
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
                  <Icon name="FaUsers" className="h-4 w-4 text-gray-400" />
                  <span>
                    {Array.isArray(minute?.participants) && minute.participants.length
                      ? `${minute.participants.length} participantes`
                      : "Sin participantes"}
                  </span>
                </div>
              </div>

              <div className="mt-auto flex min-h-[56px] flex-col justify-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-700/80 sm:flex-row sm:items-center sm:justify-between">
                {Number(minute?.totalTokens || 0) > 0 ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400">{minute.totalTokens} tokens</div>
                ) : <div />}
                <div className="flex justify-end gap-2">
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
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default HistoryCardView;
