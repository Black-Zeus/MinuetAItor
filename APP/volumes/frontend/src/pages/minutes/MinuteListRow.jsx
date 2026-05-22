import React from "react";
import { useNavigate } from "react-router-dom";

import Icon from "@/components/ui/icon/iconManager";
import { openPdfViewer } from "@/components/ui/pdf/PdfViewerModal";

import {
  buildMinuteFilename,
  getMinuteStatusConfig,
  showConfirmCancelModal,
} from "./MinuteCard";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_BODY = "text-gray-700 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const ActionButton = ({ label, icon, onClick, tone = "default" }) => {
  const toneClass = {
    default:
      "border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-300",
    success:
      "border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/20",
    danger:
      "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
        toneClass[tone] ?? toneClass.default,
      ].join(" ")}
    >
      <Icon name={icon} className="text-[11px]" />
      {label}
    </button>
  );
};

const MinuteListRow = ({ minute, onStatusChange, onReprocess }) => {
  const navigate = useNavigate();
  const statusConfig = getMinuteStatusConfig(minute);
  const status = String(minute?.status ?? "in-progress");
  const participants = Array.isArray(minute?.participants) ? minute.participants : [];
  const tags = Array.isArray(minute?.tags) ? minute.tags : [];
  const filename = buildMinuteFilename(minute?.title, minute?.date);

  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const isDeleted = status === "deleted";
  const canReprocess = Boolean(minute?.can_reprocess);
  const isFailed =
    status === "llm-failed" ||
    status === "processing-error" ||
    (status === "in-progress" && canReprocess);

  const goToEditor = () => {
    if (minute?.id) navigate(`/minutes/process/${minute.id}`);
  };

  const handleViewPdf = () => {
    if (!minute?.id) return;
    openPdfViewer({
      recordId: minute.id,
      pdfType: isCompleted ? "published" : "draft",
      filename,
      title: `PDF — ${minute?.title || "Minuta"}`,
    });
  };

  const handleCancel = () => {
    if (!minute?.id) return;
    showConfirmCancelModal({ minuteId: minute.id, onConfirm: onStatusChange });
  };

  return (
    <div className="rounded-2xl border border-secondary-200 bg-surface p-4 shadow-card transition-all duration-200 hover:border-primary-500 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 dark:hover:border-primary-400">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className={`text-base font-semibold ${TXT_TITLE} truncate`}>
              {minute?.title || "Minuta sin título"}
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusConfig.className}`}
            >
              <Icon
                name={statusConfig.icon}
                className={statusConfig.icon === "spinner" ? "animate-spin text-[11px]" : "text-[11px]"}
              />
              {statusConfig.label}
            </span>
          </div>

          <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${TXT_META}`}>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="business" className="text-xs" />
              {minute?.client || "Sin cliente"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="folder" className="text-xs" />
              {minute?.project || "Sin proyecto"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" className="text-xs" />
              {minute?.date || "-"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="penToSquare" className="text-xs" />
              {minute?.preparedBy || "Sin elaborador"}
            </span>
          </div>

          <p className={`mt-3 line-clamp-2 text-sm leading-relaxed ${TXT_BODY}`}>
            {minute?.summary || <span className="italic text-gray-400 dark:text-gray-500">Sin resumen disponible</span>}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {participants.slice(0, 4).map((participant, idx) => (
              <span
                key={`${participant}-${idx}`}
                className={`rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium ${TXT_BODY} dark:bg-gray-800/60`}
              >
                {participant}
              </span>
            ))}
            {participants.length > 4 ? (
              <span className={`rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium ${TXT_META} dark:bg-gray-800/60`}>
                +{participants.length - 4}
              </span>
            ) : null}
            {tags.slice(0, 3).map((tag, idx) => (
              <span
                key={`${tag?.label ?? "tag"}-${idx}`}
                style={{ backgroundColor: `${tag?.color}18`, color: tag?.color }}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold"
              >
                {tag?.label ?? "Etiqueta"}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:max-w-[360px] xl:justify-end">
          {isCancelled || isDeleted ? (
            <span className={`inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-xs ${TXT_META} dark:border-gray-700`}>
              Sin acciones disponibles
            </span>
          ) : isFailed ? (
            <>
              <ActionButton label="Reprocesar" icon="arrowsRotate" onClick={() => onReprocess?.(minute?.id)} />
              <ActionButton label="Anular" icon="ban" onClick={handleCancel} tone="danger" />
            </>
          ) : isCompleted ? (
            <>
              <ActionButton label="Ver" icon="eye" onClick={goToEditor} />
              <ActionButton label="Ver PDF" icon="fileLines" onClick={handleViewPdf} tone="success" />
            </>
          ) : (
            <>
              <ActionButton
                label={status === "preview" ? "Ver" : "Editar"}
                icon={status === "preview" ? "eye" : "edit"}
                onClick={goToEditor}
              />
              {status !== "in-progress" ? (
                <ActionButton label="Ver PDF" icon="fileLines" onClick={handleViewPdf} tone="success" />
              ) : null}
              <ActionButton label="Anular" icon="ban" onClick={handleCancel} tone="danger" />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MinuteListRow;
