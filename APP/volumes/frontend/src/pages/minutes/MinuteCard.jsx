// src/pages/minutes/components/MinuteCard.jsx
import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import { useNavigate } from "react-router-dom";
import { openPdfViewer } from "@/components/ui/pdf/PdfViewerModal";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_BODY  = "text-gray-700 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";

// ============================================================
// STATUS CONFIG — 9 estados según record_statuses en BD
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

const TAG_COLOR_FALLBACK = "bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200";

const safeArray    = (v)      => (Array.isArray(v) ? v : []);
const getStatusCfg = (status) => STATUS_CONFIG?.[status] ?? STATUS_CONFIG["processing-error"];

// ============================================================
// HELPERS — filename
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

// ============================================================
// MODAL: Anular — componente React controlado
// ============================================================
const CancelModalContent = ({ minuteId, onConfirm }) => {
  const [motivo,      setMotivo]      = React.useState("");
  const [hasError,    setHasError]    = React.useState(false);
  const [submitting,  setSubmitting]  = React.useState(false);
  const mountedRef = React.useRef(true);
  React.useEffect(() => () => { mountedRef.current = false; }, []);

  const handleSubmit = async () => {
    if (!motivo.trim()) { setHasError(true); return; }
    setSubmitting(true);
    try {
      await onConfirm?.(minuteId, "cancelled", motivo.trim());
      ModalManager.closeAll?.();
    } catch {
      // El interceptor de axios ya muestra el toast de error
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-700/40">
        <Icon name="triangleExclamation" className="text-red-500 dark:text-red-400 mt-0.5 shrink-0 text-sm" />
        <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
          La minuta pasará a estado <strong>Cancelado</strong> y no podrá ser editada ni descargada.
          El registro quedará visible para fines de trazabilidad.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Motivo <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={3}
          value={motivo}
          placeholder="Describe el motivo de la anulación..."
          onChange={(e) => { setMotivo(e.target.value); if (e.target.value.trim()) setHasError(false); }}
          className={[
            "w-full px-3 py-2 rounded-lg text-sm resize-none transition-colors",
            "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200",
            "placeholder-gray-400 dark:placeholder-gray-500",
            "focus:outline-none focus:ring-4",
            hasError
              ? "border border-red-500 focus:border-red-500 focus:ring-red-500/10"
              : "border border-gray-200 dark:border-gray-700 focus:border-primary-500 focus:ring-primary-500/10",
          ].join(" ")}
        />
        {hasError && (
          <p className="text-xs text-red-500 mt-1">El motivo es obligatorio para anular la minuta.</p>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={() => ModalManager.closeAll?.()}
          disabled={submitting}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting && <Icon name="spinner" className="animate-spin text-xs" />}
          {submitting ? "Anulando..." : "Anular minuta"}
        </button>
      </div>
    </div>
  );
};

const showConfirmCancelModal = ({ minuteId, onConfirm }) => {
  ModalManager.custom({
    title:      "Anular minuta",
    size:       "small",
    showFooter: false,
    content:    <CancelModalContent minuteId={minuteId} onConfirm={onConfirm} />,
  });
};

// ============================================================
// SUBCOMPONENTE: CardHeader
// ============================================================
const CardHeader = ({ minute, statusConfig }) => {
  const title   = String(minute?.title ?? "");
  const titleUi = title.length > 28 ? `${title.slice(0, 28)}...` : title;
  const timeLine = [minute?.time, minute?.duration].filter(Boolean).join(" • ") || "-";

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
            {timeLine}
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

      <div className={`flex items-center gap-2 mb-4 text-sm ${TXT_BODY} transition-theme`}>
        <Icon name="penToSquare" className="text-primary-500 dark:text-primary-400 text-sm" />
        <span>{minute?.preparedBy ?? "Sin elaborador"}</span>
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
// Acciones por estado (simplificadas — transiciones solo en editor):
//
//   in-progress      → [Anular]                          (1 botón)
//   ready-for-edit   → [Editar]  [Ver PDF] [Anular]      (3 botones)
//   pending          → [Editar]  [Ver PDF] [Anular]      (3 botones)
//   preview          → [Ver]     [Ver PDF] [Anular]      (3 botones)
//   completed        → [Ver]     [Ver PDF]               (2 botones)
//   cancelled        → sin acciones
//   llm-failed       → mensaje de error, sin acciones
//   processing-error → mensaje de error, sin acciones
//   deleted          → sin acciones
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

const BTN_HOVER_DANGER = [
  "cursor-pointer",
  "hover:bg-red-50 hover:text-red-600 hover:border-red-200",
  "dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-700",
].join(" ");

const FooterBtn = ({ icon, label, tooltip, onClick, variant = "default" }) => {
  const variantMap = {
    default: BTN_HOVER_DEFAULT,
    success: BTN_HOVER_SUCCESS,
    danger:  BTN_HOVER_DANGER,
  };

  return (
    <button onClick={onClick} className={`${BTN_BASE} ${variantMap[variant] ?? BTN_HOVER_DEFAULT}`}>
      {icon}
      {label && <span className="ml-1">{label}</span>}
      {tooltip && (
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
      )}
    </button>
  );
};

const CardFooter = ({ minute, onStatusChange }) => {
  const navigate = useNavigate();
  const minuteId = minute?.id;
  const status   = String(minute?.status ?? "in-progress");
  const filename = buildMinuteFilename(minute?.title, minute?.date);

  const isInProgress      = status === "in-progress";
  const isReadyForEdit    = status === "ready-for-edit";
  const isPending         = status === "pending";
  const isPreview         = status === "preview";
  const isCompleted       = status === "completed";
  const isCancelled       = status === "cancelled";
  const isLlmFailed       = status === "llm-failed";
  const isProcessingError = status === "processing-error";

  const goToEditor  = () => { if (minuteId) navigate(`/minutes/process/${minuteId}`); };
  const handleCancel = () => showConfirmCancelModal({ minuteId, onConfirm: onStatusChange });
  const handleViewPdf = () => {
    if (!minuteId) return;

    const pdfType = isCompleted ? "published" : "draft";
    openPdfViewer({
      recordId: minuteId,
      pdfType,
      filename,
      title: `PDF — ${minute?.title || "Minuta"}`,
    });
  };

  // ── Sin acciones ─────────────────────────────────────────────────────────
  if (isCancelled) {
    return (
      <div className="px-4 py-3 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme flex items-center justify-center">
        <span className="text-xs text-gray-400 dark:text-gray-500 italic">Sin acciones disponibles</span>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
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

  // ── Completed: Ver + Ver PDF ──────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme">
        <div className="grid grid-cols-2 gap-2">
          <FooterBtn
            icon={<Icon name="eye" />}
            label="Ver"
            tooltip="Ver minuta (solo lectura)"
            onClick={goToEditor}
          />
          <FooterBtn
            icon={<Icon name="fileLines" />}
            label="Ver PDF"
            tooltip="Ver PDF publicado"
            onClick={handleViewPdf}
            variant="success"
          />
        </div>
      </div>
    );
  }

  // ── In-progress: solo Anular ──────────────────────────────────────────────
  if (isInProgress) {
    return (
      <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme">
        <FooterBtn
          icon={<Icon name="ban" />}
          label="Anular"
          tooltip="Anular minuta"
          onClick={handleCancel}
          variant="danger"
        />
      </div>
    );
  }

  // ── Ready-for-edit / Pending / Preview: acción principal + PDF + anular ───
  if (isReadyForEdit || isPending || isPreview) {
    return (
      <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme">
        <div className="grid grid-cols-3 gap-2">
          <FooterBtn
            icon={<Icon name={isPreview ? "eye" : "edit"} />}
            label={isPreview ? "Ver" : "Editar"}
            tooltip={
              isReadyForEdit
                ? "Abrir editor — primera edición"
                : isPending
                  ? "Continuar edición"
                  : "Ver minuta en revisión (solo lectura)"
            }
            onClick={goToEditor}
          />
          <FooterBtn
            icon={<Icon name="fileLines" />}
            label="Ver PDF"
            tooltip={
              isReadyForEdit
                ? "Ver PDF borrador inicial"
                : isPending
                  ? "Ver PDF borrador actual"
                  : "Ver PDF borrador"
            }
            onClick={handleViewPdf}
            variant="success"
          />
          <FooterBtn
            icon={<Icon name="ban" />}
            label="Anular"
            tooltip="Anular minuta"
            onClick={handleCancel}
            variant="danger"
          />
        </div>
      </div>
    );
  }

  // ── Fallback restante: Editar + Anular ────────────────────────────────────
  return (
    <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme">
      <div className="grid grid-cols-2 gap-2">
        <FooterBtn
          icon={<Icon name="edit" />}
          label="Editar"
          tooltip={isReadyForEdit ? "Abrir editor — primera edición" : "Continuar edición"}
          onClick={goToEditor}
        />
        <FooterBtn
          icon={<Icon name="ban" />}
          label="Anular"
          tooltip="Anular minuta"
          onClick={handleCancel}
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
  const status       = String(minute?.status ?? "in-progress");
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
