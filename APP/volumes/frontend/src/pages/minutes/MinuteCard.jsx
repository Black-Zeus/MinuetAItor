// src/pages/minutes/components/MinuteCard.jsx
import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import ModalManager from "@/components/ui/modal";
import { useNavigate } from "react-router-dom";

import logger from "@/utils/logger";
const minuteLog = logger.scope("minute");

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_BODY  = "text-gray-700 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";

const DEMO_PDF_URL = "/pdf/demo.pdf";

// ============================================================
// STATUS CONFIG — 9 estados según record_statuses en BD
//
// Transiciones válidas (del backend):
//   ready-for-edit   → pending | deleted
//   pending          → preview | cancelled | deleted
//   preview          → pending | completed | cancelled | deleted
//   cancelled        → deleted
//   llm-failed       → deleted
//   processing-error → deleted
//   completed        → (terminal)
//   deleted          → (terminal, nunca se muestra)
//   in-progress      → (solo lectura, la IA está procesando)
// ============================================================
const STATUS_CONFIG = {
  "in-progress": {
    label:     "En procesamiento",
    icon:      "spinner",
    className: "bg-blue-50 text-[#1e3a8a] dark:bg-blue-900/20 dark:text-blue-400",
  },
  "ready-for-edit": {
    label:     "Listo para editar",
    icon:      "edit",
    className: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
  },
  "pending": {
    label:     "En edición",
    icon:      "penToSquare",
    className: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
  },
  "preview": {
    label:     "En revisión",
    icon:      "eye",
    className: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
  },
  "completed": {
    label:     "Completado",
    icon:      "checkCircle",
    className: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  },
  "cancelled": {
    label:     "Cancelado",
    icon:      "ban",
    className: "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400",
  },
  "llm-failed": {
    label:     "Fallo IA",
    icon:      "triangleExclamation",
    className: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
  },
  "processing-error": {
    label:     "Error de proceso",
    icon:      "circleXmark",
    className: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
  },
  "deleted": {
    label:     "Eliminado",
    icon:      "trash",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400",
  },
};

// TAG_COLORS — mapea el color hex que devuelve el backend a clases Tailwind.
// El backend envía hex (#FF1744) como color de tag.
// Para el listado usamos un mapa de categorías semánticas como fallback.
const TAG_COLOR_FALLBACK = "bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200";

const safeArray    = (v)      => (Array.isArray(v) ? v : []);
const getStatusCfg = (status) => STATUS_CONFIG?.[status] ?? STATUS_CONFIG["processing-error"];

// ============================================================
// HELPERS — filename + download
// ============================================================
const buildMinuteFilename = (subject, dateMeeting) => {
  const rawTitle = String(subject ?? "minuta").trim() || "minuta";
  const safeTitle =
    rawTitle
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "").slice(0, 60) || "minuta";

  const pad2 = (n) => String(n).padStart(2, "0");
  const parseDate = (v) => {
    const s = String(v ?? "").trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return { yyyy: m[1], mm: m[2], dd: m[3] };
    m = s.match(/^(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,})\s+(\d{4})$/);
    if (m) {
      const dd = pad2(m[1]);
      const monRaw = m[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const monthMap = { ene:"01",feb:"02",mar:"03",abr:"04",may:"05",jun:"06",
                         jul:"07",ago:"08",sep:"09",set:"09",oct:"10",nov:"11",dic:"12" };
      const mm = monthMap[monRaw.slice(0, 3)];
      if (mm) return { yyyy: m[3], mm, dd };
    }
    const now = new Date();
    return { yyyy: String(now.getFullYear()), mm: pad2(now.getMonth() + 1), dd: pad2(now.getDate()) };
  };

  const d = parseDate(dateMeeting);
  return `${d.yyyy}${d.mm}${d.dd}_${safeTitle}.pdf`;
};

const triggerBrowserDownload = async (url, filename) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo descargar PDF (${res.status})`);
  const blob      = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a         = document.createElement("a");
  a.href     = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
};

// ============================================================
// MODALS
// ============================================================
const showDownloadModal = ({ filename }) => {
  const handleDownload = async () => {
    try {
      await triggerBrowserDownload(DEMO_PDF_URL, filename);
    } catch {
      ModalManager.error?.({ title: "Error", message: "No fue posible descargar el PDF." });
    }
  };

  ModalManager.custom({
    title:      "Descargar Minuta (PDF)",
    size:       "xlarge",
    showFooter: false,
    content: (
      <div className="p-6 space-y-4">
        <ActionButton
          label={filename} variant="soft" size="sm"
          icon={<Icon name="download" />} onClick={handleDownload}
          tooltip="Descargar PDF" className="mt-2 w-full text-center !px-4"
        />
        <div className="border border-secondary-200 dark:border-secondary-700/60 rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
          <div className="px-4 py-2 border-b border-secondary-200 dark:border-secondary-700/60 text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
            <Icon name="eye" /> Vista previa
          </div>
          <div className="w-full h-[60vh]">
            <iframe src={DEMO_PDF_URL} title="Vista previa PDF" className="w-full h-full" />
          </div>
        </div>
      </div>
    ),
  });
};

// ── Publicar (preview → completed) ──────────────────────────────────────────
const showConfirmPublishModal = async ({ minuteId, onConfirm }) => {
  try {
    const confirmed = await ModalManager.confirm({
      title:       "Publicar minuta",
      message:
        "Al publicar, la minuta quedará en estado Completado y no podrá ser modificada nuevamente.\n\n" +
        "Esta acción indica que los participantes han aprobado el contenido y el documento se considera oficial.",
      confirmText: "Publicar minuta",
      cancelText:  "Cancelar",
    });
    if (confirmed) onConfirm?.(minuteId, "completed");
  } catch {
    minuteLog.log("Publicación cancelada");
  }
};

// ── Enviar a revisión (pending → preview) ───────────────────────────────────
const showConfirmPreviewModal = async ({ minuteId, onConfirm }) => {
  try {
    const confirmed = await ModalManager.confirm({
      title:       "Enviar a revisión",
      message:
        "La minuta pasará a estado En revisión.\n\n" +
        "La edición quedará bloqueada hasta que sea aprobada o devuelta para correcciones.",
      confirmText: "Enviar a revisión",
      cancelText:  "Cancelar",
    });
    if (confirmed) onConfirm?.(minuteId, "preview");
  } catch {
    minuteLog.log("Envío a revisión cancelado");
  }
};

// ── Devolver a edición (preview → pending) ───────────────────────────────────
const showConfirmReturnToPendingModal = async ({ minuteId, onConfirm }) => {
  try {
    const confirmed = await ModalManager.confirm({
      title:       "Devolver a edición",
      message:
        "La minuta volverá a estado En edición y podrá ser modificada nuevamente.",
      confirmText: "Devolver a edición",
      cancelText:  "Cancelar",
    });
    if (confirmed) onConfirm?.(minuteId, "pending");
  } catch {
    minuteLog.log("Devolución cancelada");
  }
};

// ── Anular ───────────────────────────────────────────────────────────────────
const showConfirmCancelModal = ({ minuteId, currentUser = "Usuario", onConfirm }) => {
  let motivoValue = "";

  const handleSubmit = () => {
    if (!motivoValue.trim()) {
      const input = document.getElementById("cancel-motivo-input");
      if (input) { input.focus(); input.classList.add("!border-red-500", "!ring-red-500/20"); }
      const error = document.getElementById("cancel-motivo-error");
      if (error) error.classList.remove("hidden");
      return;
    }
    ModalManager.closeAll?.();
    onConfirm?.(minuteId, "cancelled", motivoValue.trim());
  };

  ModalManager.custom({
    title:      "Anular minuta",
    size:       "small",
    showFooter: false,
    content: (
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-700/40">
          <Icon name="FaTriangleExclamation" className="text-red-500 dark:text-red-400 mt-0.5 shrink-0 text-sm" />
          <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
            La minuta pasará a estado <strong>Cancelado</strong> y no podrá ser editada ni descargada.
            El registro quedará visible para fines de trazabilidad.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Usuario</label>
          <input
            type="text" value={currentUser} readOnly
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 cursor-not-allowed select-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Motivo <span className="text-red-500">*</span>
          </label>
          <textarea
            id="cancel-motivo-input" rows={3}
            placeholder="Describe el motivo de la anulación..."
            onChange={(e) => {
              motivoValue = e.target.value;
              const error = document.getElementById("cancel-motivo-error");
              if (error) error.classList.add("hidden");
              e.target.classList.remove("!border-red-500", "!ring-red-500/20");
            }}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-colors"
          />
          <p id="cancel-motivo-error" className="hidden text-xs text-red-500 mt-1">
            El motivo es obligatorio para anular la minuta.
          </p>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => ModalManager.closeAll?.()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-colors"
          >
            Anular minuta
          </button>
        </div>
      </div>
    ),
  });
};

// ============================================================
// SUBCOMPONENTE: CardHeader
// ============================================================
const CardHeader = ({ minute, statusConfig }) => {
  const title   = String(minute?.title ?? "");
  const titleUi = title.length > 28 ? `${title.slice(0, 28)}...` : title;

  return (
    <div className="p-6 border-b border-secondary-200 dark:border-secondary-700/60 transition-theme min-h-[120px]">
      <div className="grid grid-cols-2 gap-3 items-start">
        <h3
          className={`col-span-2 text-lg font-semibold ${TXT_TITLE} leading-snug transition-theme text-center`}
          title={title}
        >
          {titleUi}
        </h3>
        <div className={`flex flex-col gap-2 text-xs ${TXT_META} transition-theme`}>
          <span className="flex items-center gap-1.5">
            <Icon name="calendar" className="text-xs" />
            {minute?.date ?? "-"}
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="clock" className="text-xs" />
            {minute?.time ?? "-"}
          </span>
        </div>
        <div className="flex justify-end">
          <div
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-theme ${statusConfig.className}`}
            title={`Estado: ${statusConfig.label}`}
          >
            <Icon name={statusConfig.icon} className={statusConfig.icon === "spinner" ? "animate-spin" : ""} />
            {statusConfig.label}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SUBCOMPONENTE: CardBody
// ============================================================
const CardBody = ({ minute }) => {
  const participants = safeArray(minute?.participants);
  const tags         = safeArray(minute?.tags);

  return (
    <div className="p-6">
      <div className={`flex flex-wrap gap-4 mb-4 text-sm ${TXT_BODY} transition-theme`}>
        <div className="flex items-center gap-2">
          <Icon name="business" className="text-primary-500 dark:text-primary-400 text-sm" />
          <span>{minute?.client ?? "-"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="folder" className="text-primary-500 dark:text-primary-400 text-sm" />
          <span>{minute?.project ?? "-"}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <Icon name="users" className="text-primary-500 dark:text-primary-400 text-sm" />
        <div className="flex flex-wrap gap-2">
          {participants.length === 0 ? (
            <span className={`px-2.5 py-1 bg-gray-100 dark:bg-gray-800/60 ${TXT_BODY} rounded-lg text-xs font-medium transition-theme`}>
              Sin participantes
            </span>
          ) : (
            participants.map((p, idx) => (
              <span key={idx} className={`px-2.5 py-1 bg-gray-100 dark:bg-gray-800/60 ${TXT_BODY} rounded-lg text-xs font-medium transition-theme`}>
                {p}
              </span>
            ))
          )}
        </div>
      </div>

      <div className={`text-sm ${TXT_BODY} leading-relaxed mb-4 line-clamp-3 transition-theme`}>
        {minute?.summary ?? <span className="italic text-gray-400 dark:text-gray-500">Sin resumen disponible</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag, idx) => (
          <span
            key={idx}
            style={{ backgroundColor: `${tag?.color}18`, color: tag?.color }}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-theme"
          >
            {tag?.label ?? "Etiqueta"}
          </span>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// SUBCOMPONENTE: CardFooter
//
// Lógica de botones por estado:
//
//   in-progress      → [-]      [-]       [-]        [Anular]  (solo anular)
//   ready-for-edit   → [Editar] [-]       [-]        [Anular]
//   pending          → [Editar] [Revisión][-]        [Anular]
//   preview          → [-]      [Publicar][Devolver]  [Anular]
//   completed        → [-]      [-]       [Descargar] [-]      (solo descarga)
//   cancelled        → footer sin acciones
//   llm-failed       → footer de error (sin acciones activas)
//   processing-error → footer de error (sin acciones activas)
//   deleted          → footer sin acciones
//
// Transiciones:
//   ready-for-edit → pending          (btn Editar navega al editor)
//   pending        → preview          (btn Enviar a revisión)
//   pending        → cancelled        (btn Anular)
//   preview        → completed        (btn Publicar)
//   preview        → pending          (btn Devolver a edición)
//   preview        → cancelled        (btn Anular)
//   in-progress    → cancelled        (btn Anular)
//   ready-for-edit → cancelled        (btn Anular — vía commit_message)
// ============================================================

const BTN_BASE = [
  "flex items-center justify-center gap-1.5 w-full",
  "px-3 py-2 rounded-lg text-xs font-medium",
  "border border-gray-200 dark:border-gray-700",
  "text-gray-500 dark:text-gray-400 bg-transparent",
  "transition-all duration-150 select-none relative group focus:outline-none",
].join(" ");

const BTN_HOVER_DEFAULT = [
  "cursor-pointer",
  "hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200",
  "dark:hover:bg-blue-900/20 dark:hover:text-blue-400 dark:hover:border-blue-700",
].join(" ");

const BTN_HOVER_SUCCESS = [
  "cursor-pointer",
  "hover:bg-green-50 hover:text-green-700 hover:border-green-200",
  "dark:hover:bg-green-900/20 dark:hover:text-green-400 dark:hover:border-green-700",
].join(" ");

const BTN_HOVER_WARNING = [
  "cursor-pointer",
  "hover:bg-yellow-50 hover:text-yellow-600 hover:border-yellow-200",
  "dark:hover:bg-yellow-900/20 dark:hover:text-yellow-400 dark:hover:border-yellow-700",
].join(" ");

const BTN_HOVER_DANGER = [
  "cursor-pointer",
  "hover:bg-red-50 hover:text-red-600 hover:border-red-200",
  "dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-700",
].join(" ");

const BTN_DISABLED = "opacity-40 cursor-not-allowed";

const FooterBtn = ({ icon, tooltip, onClick, disabled = false, variant = "default" }) => {
  const variantMap = {
    default: BTN_HOVER_DEFAULT,
    success: BTN_HOVER_SUCCESS,
    warning: BTN_HOVER_WARNING,
    danger:  BTN_HOVER_DANGER,
  };
  const hoverClass = variantMap[variant] ?? BTN_HOVER_DEFAULT;
  const stateClass = disabled ? BTN_DISABLED : hoverClass;

  return (
    <button onClick={disabled ? undefined : onClick} className={`${BTN_BASE} ${stateClass}`}>
      {icon}
      <span className="
        pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2
        px-2.5 py-1.5 rounded-lg bg-gray-800 dark:bg-gray-700
        text-white text-xs font-normal leading-snug
        w-max max-w-[180px] text-center
        opacity-0 group-hover:opacity-100 transition-opacity duration-150
        z-[9999] shadow-lg
      ">
        {tooltip}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-800 dark:border-t-gray-700" />
      </span>
    </button>
  );
};

const CardFooter = ({ minute, onStatusChange }) => {
  const navigate  = useNavigate();
  const minuteId  = minute?.id;
  const status    = String(minute?.status ?? "in-progress");
  const filename  = buildMinuteFilename(minute?.title, minute?.date);

  // ── Booleans de estado ──────────────────────────────────────────────────
  const isInProgress      = status === "in-progress";
  const isReadyForEdit    = status === "ready-for-edit";
  const isPending         = status === "pending";
  const isPreview         = status === "preview";
  const isCompleted       = status === "completed";
  const isCancelled       = status === "cancelled";
  const isLlmFailed       = status === "llm-failed";
  const isProcessingError = status === "processing-error";
  const isDeleted         = status === "deleted";

  // ── Estados terminales / sin acciones ───────────────────────────────────
  if (isCancelled || isDeleted) {
    return (
      <div className="px-4 py-3 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme flex items-center justify-center">
        <span className="text-xs text-gray-400 dark:text-gray-500 italic">Sin acciones disponibles</span>
      </div>
    );
  }

  // ── Estados de error — solo muestra info, sin acciones ──────────────────
  if (isLlmFailed || isProcessingError) {
    return (
      <div className="px-4 py-3 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme flex items-center justify-center gap-2">
        <Icon name="triangleExclamation" className="text-red-400 text-xs" />
        <span className="text-xs text-red-500 dark:text-red-400 italic">
          {isLlmFailed ? "Fallo en el procesamiento IA" : "Error interno de proceso"}
        </span>
      </div>
    );
  }

  // ── Completed — solo descarga ───────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme">
        <button
          onClick={() => showDownloadModal({ filename })}
          className={`${BTN_BASE} ${BTN_HOVER_SUCCESS} w-full`}
        >
          <Icon name="download" />
          <span className="ml-1">Descargar PDF</span>
        </button>
      </div>
    );
  }

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleEdit       = () => { if (minuteId) navigate(`/minutes/process/${minuteId}`); };
  const handleToPreview  = () => showConfirmPreviewModal({ minuteId, onConfirm: onStatusChange });
  const handlePublish    = () => showConfirmPublishModal({ minuteId, onConfirm: onStatusChange });
  const handleReturn     = () => showConfirmReturnToPendingModal({ minuteId, onConfirm: onStatusChange });
  const handleCancel     = () => showConfirmCancelModal({ minuteId, onConfirm: onStatusChange });

  // ── Reglas de disponibilidad por estado ─────────────────────────────────
  //
  //   in-progress:    canEdit=F  canToPreview=F  canPublish=F  canReturn=F  canCancel=T
  //   ready-for-edit: canEdit=T  canToPreview=F  canPublish=F  canReturn=F  canCancel=T
  //   pending:        canEdit=T  canToPreview=T  canPublish=F  canReturn=F  canCancel=T
  //   preview:        canEdit=F  canToPreview=F  canPublish=T  canReturn=T  canCancel=T

  const canEdit      = isReadyForEdit || isPending;
  const canToPreview = isPending;
  const canPublish   = isPreview;
  const canReturn    = isPreview;
  const canCancel    = isInProgress || isReadyForEdit || isPending || isPreview;

  // ── Tooltips ─────────────────────────────────────────────────────────────
  const tooltipEdit = canEdit
    ? "Editar contenido de la minuta"
    : isInProgress
      ? "La minuta aún está siendo procesada por la IA"
      : isPreview
        ? "La edición está bloqueada durante la revisión"
        : "Sin acceso de edición en este estado";

  const tooltipPreview = canToPreview
    ? "Enviar a revisión — bloquea la edición hasta aprobación"
    : isPreview
      ? "La minuta ya está en revisión"
      : isInProgress || isReadyForEdit
        ? "Primero edita y guarda la minuta"
        : "No disponible en este estado";

  const tooltipPublish = canPublish
    ? "Publicar minuta — acción irreversible, pasa a Completado"
    : isCompleted
      ? "La minuta ya fue publicada"
      : "Solo disponible en estado En revisión";

  const tooltipReturn = canReturn
    ? "Devolver a edición — desbloquea modificaciones"
    : "Solo disponible en estado En revisión";

  const tooltipCancel = canCancel
    ? "Anular minuta — quedará visible solo para trazabilidad"
    : "No disponible en este estado";

  // ── Layout del footer según estado ───────────────────────────────────────
  //
  //   in-progress:    [Edit↓] [Preview↓] [Publish↓]  [Anular]   (3 deshabilitados + anular)
  //   ready-for-edit: [Editar][Preview↓] [Publish↓]  [Anular]
  //   pending:        [Editar][Revisión]  [Publish↓]  [Anular]
  //   preview:        [Edit↓] [Return]   [Publicar]  [Anular]

  return (
    <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme">
      <div className="grid grid-cols-4 gap-2">

        {/* EDITAR */}
        <FooterBtn
          icon={<Icon name="edit" />}
          tooltip={tooltipEdit}
          onClick={handleEdit}
          disabled={!canEdit}
        />

        {/* ENVIAR A REVISIÓN / DEVOLVER */}
        {isPreview ? (
          <FooterBtn
            icon={<Icon name="FaRotateLeft" />}
            tooltip={tooltipReturn}
            onClick={handleReturn}
            disabled={!canReturn}
            variant="warning"
          />
        ) : (
          <FooterBtn
            icon={<Icon name="FaMagnifyingGlass" />}
            tooltip={tooltipPreview}
            onClick={handleToPreview}
            disabled={!canToPreview}
          />
        )}

        {/* PUBLICAR */}
        <FooterBtn
          icon={<Icon name="checkCircle" />}
          tooltip={tooltipPublish}
          onClick={handlePublish}
          disabled={!canPublish}
          variant="success"
        />

        {/* ANULAR */}
        <FooterBtn
          icon={<Icon name="ban" />}
          tooltip={tooltipCancel}
          onClick={handleCancel}
          disabled={!canCancel}
          variant="danger"
        />

      </div>
    </div>
  );
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
const MinuteCard = ({ minute, onStatusChange }) => {
  const status      = String(minute?.status ?? "in-progress");
  const statusConfig = getStatusCfg(status);

  return (
    <div className="bg-surface rounded-2xl border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 transition-all duration-200 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary-500 dark:hover:border-primary-400 h-full flex flex-col">
      <CardHeader minute={minute} statusConfig={statusConfig} />
      <div className="flex-1">
        <CardBody minute={minute} />
      </div>
      <CardFooter minute={minute} onStatusChange={onStatusChange} />
    </div>
  );
};

export default MinuteCard;