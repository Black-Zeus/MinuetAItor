import React from "react";
import { useNavigate } from "react-router-dom";

import Icon from "@/components/ui/icon/iconManager";
import SortableTableHeader from "@/components/common/SortableTableHeader";
import { openPdfViewer } from "@/components/ui/pdf/PdfViewerModal";
import useTableSorting from "@/hooks/useTableSorting";

import {
  buildMinuteFilename,
  getMinuteStatusConfig,
  showConfirmCancelModal,
} from "./MinuteCard";

const TXT_HEAD = "text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400";
const TXT_BODY = "text-sm text-gray-700 dark:text-gray-300";
const TXT_TITLE = "text-sm font-semibold text-gray-900 dark:text-gray-50";

const TableActionButton = ({ icon, label, onClick, tone = "default", className = "" }) => {
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
        "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
        toneClass[tone] ?? toneClass.default,
        className,
      ].join(" ")}
    >
      <Icon name={icon} className="text-[11px]" />
      {label}
    </button>
  );
};

const MinutesTableView = ({ minutes = [], onStatusChange, onReprocess, isRefreshing = false }) => {
  const navigate = useNavigate();
  const { sortedItems, sortConfig, toggleSort } = useTableSorting(minutes, {
    client: (minute) => minute?.client,
    project: (minute) => minute?.project,
    minute: (minute) => minute?.title,
    preparedAt: (minute) => {
      if (!minute?.date) return null;
      const timestamp = new Date(minute.date).getTime();
      return Number.isFinite(timestamp) ? timestamp : minute.date;
    },
    status: (minute) => minute?.status,
  });

  const buildActions = ({ minute, status, isCompleted, isCancelled, isDeleted, isFailed, handleCancel, handleViewPdf, goToEditor }) => {
    if (isCancelled || isDeleted) {
      return [
        {
          key: "empty",
          node: (
            <span className="inline-flex w-full items-center justify-center rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
              Sin acciones
            </span>
          ),
        },
      ];
    }

    if (isFailed) {
      return [
        { key: "reprocess", node: <TableActionButton icon="arrowsRotate" label="Reprocesar" onClick={() => onReprocess?.(minute?.id)} /> },
        { key: "cancel", node: <TableActionButton icon="ban" label="Anular" onClick={handleCancel} tone="danger" /> },
      ];
    }

    if (isCompleted) {
      return [
        { key: "view", node: <TableActionButton icon="eye" label="Ver" onClick={goToEditor} /> },
        { key: "pdf", node: <TableActionButton icon="fileLines" label="PDF" onClick={handleViewPdf} tone="success" /> },
      ];
    }

    const actions = [
      {
        key: "edit",
        node: (
          <TableActionButton
            icon={status === "preview" ? "eye" : "edit"}
            label={status === "preview" ? "Ver" : "Editar"}
            onClick={goToEditor}
          />
        ),
      },
    ];

    if (status !== "in-progress") {
      actions.push(
        { key: "pdf", node: <TableActionButton icon="fileLines" label="PDF" onClick={handleViewPdf} tone="success" /> }
      );
    }

    actions.push(
      { key: "cancel", node: <TableActionButton icon="ban" label="Anular" onClick={handleCancel} tone="danger" /> }
    );

    return actions;
  };

  return (
    <div
      className={`mb-8 overflow-hidden rounded-2xl border border-secondary-200 bg-white shadow-card transition-opacity duration-200 dark:border-secondary-700/60 dark:bg-slate-900/40 dark:ring-1 dark:ring-white/5 ${
        isRefreshing ? "opacity-50 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-secondary-200 bg-gray-50/80 dark:border-secondary-700/60 dark:bg-slate-900/60">
              <th className={`px-4 py-3 text-left ${TXT_HEAD}`}><SortableTableHeader label="Cliente" sortKey="client" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className={`px-4 py-3 text-left ${TXT_HEAD}`}><SortableTableHeader label="Proyecto" sortKey="project" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className={`px-4 py-3 text-left ${TXT_HEAD}`}><SortableTableHeader label="Minuta" sortKey="minute" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className={`px-4 py-3 text-left ${TXT_HEAD}`}><SortableTableHeader label="Fecha elaborado" sortKey="preparedAt" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className={`px-4 py-3 text-left ${TXT_HEAD}`}><SortableTableHeader label="Estado" sortKey="status" activeSortKey={sortConfig?.key} direction={sortConfig?.direction} onSort={toggleSort} /></th>
              <th className={`px-4 py-3 text-left ${TXT_HEAD}`}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {sortedItems.map((minute) => {
              const statusConfig = getMinuteStatusConfig(minute);
              const status = minute?.is_reprocess_pending ? "in-progress" : String(minute?.status ?? "in-progress");
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

              const actions = buildActions({
                minute,
                status,
                isCompleted,
                isCancelled,
                isDeleted,
                isFailed,
                handleCancel,
                handleViewPdf,
                goToEditor,
              });
              const actionGridClass = actions.length <= 1 ? "grid-cols-1" : "grid-cols-2";
              const hasOddActionCount = actions.length > 1 && actions.length % 2 === 1;

              return (
                <tr
                  key={minute.id}
                  className="border-b border-secondary-200/80 align-top transition-colors hover:bg-gray-50/70 dark:border-secondary-700/40 dark:hover:bg-slate-800/30"
                >
                  <td className={`px-4 py-4 ${TXT_BODY}`}>{minute?.client || "-"}</td>
                  <td className={`px-4 py-4 ${TXT_BODY}`}>{minute?.project || "-"}</td>
                  <td className="px-4 py-4">
                    <div className="min-w-[220px]">
                      <p className={TXT_TITLE}>{minute?.title || "Minuta sin título"}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                        {minute?.summary || "Sin resumen disponible"}
                      </p>
                    </div>
                  </td>
                  <td className={`px-4 py-4 ${TXT_BODY}`}>
                    <div>{minute?.date || "-"}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {minute?.preparedBy || "Sin elaborador"}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusConfig.className}`}
                    >
                      <Icon
                        name={statusConfig.icon}
                        className={statusConfig.icon === "spinner" ? "animate-spin text-[11px]" : "text-[11px]"}
                      />
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className={`grid min-w-[240px] gap-2 ${actionGridClass}`}>
                      {actions.map((action, index) => {
                        const isLastOdd = hasOddActionCount && index === actions.length - 1;
                        return (
                          <div key={action.key} className={isLastOdd ? "col-span-2" : ""}>
                            {action.node}
                          </div>
                        );
                      })}
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

export default MinutesTableView;
