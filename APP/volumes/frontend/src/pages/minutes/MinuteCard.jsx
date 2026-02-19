// src/pages/minutes/components/MinuteCard.jsx
import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import ModalManager from "@/components/ui/modal";
import { useNavigate } from "react-router-dom";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_BODY = "text-gray-700 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const DEMO_PDF_URL = "/pdf/demo.pdf";

// ====================================
// STATUS CONFIG
// ====================================
const STATUS_CONFIG = {
  // Azul marino — procesando con IA
  "in-progress": {
    label: "En Progreso",
    icon: "spinner",
    className: "bg-blue-50 text-[#1e3a8a] dark:bg-blue-900/20 dark:text-blue-400",
  },
  // Naranja — esperando revisión del usuario
  "ready-for-edit": {
    label: "Lista para edición",
    icon: "edit",
    className: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
  },
  // Amarillo — enviada a participantes
  pending: {
    label: "Pendiente",
    icon: "clock",
    className: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
  },
  // Verde — publicada y aprobada
  completed: {
    label: "Completada",
    icon: "checkCircle",
    className: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  },
  // Rojo — anulada
  cancelled: {
    label: "Anulada",
    icon: "ban",
    className: "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400",
  },
};

const TAG_COLORS = {
  blue:   "bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200",
  green:  "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-200",
  orange: "bg-warm-50 text-warm-700 dark:bg-warm-900/20 dark:text-warm-200",
  red:    "bg-danger-50 text-danger-700 dark:bg-danger-900/20 dark:text-danger-200",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200",
};

const safeArray = (v) => (Array.isArray(v) ? v : []);
const getStatusConfig = (status) =>
  STATUS_CONFIG?.[status] ?? STATUS_CONFIG.pending;

// ====================================
// HELPERS — filename + download
// ====================================
const buildMinuteFilename = (subject, dateMeeting) => {
  const rawTitle = String(subject ?? "minuta").trim() || "minuta";
  const safeTitle =
    rawTitle
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "minuta";

  const pad2 = (n) => String(n).padStart(2, "0");

  const parseDate = (v) => {
    const s = String(v ?? "").trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return { yyyy: m[1], mm: m[2], dd: m[3] };

    m = s.match(/^(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,})\s+(\d{4})$/);
    if (m) {
      const dd = pad2(m[1]);
      const monRaw = m[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const monthMap = {
        ene:"01", feb:"02", mar:"03", abr:"04", may:"05", jun:"06",
        jul:"07", ago:"08", sep:"09", set:"09", oct:"10", nov:"11", dic:"12",
      };
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
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
};

// ====================================
// MODALS
// ====================================
const showDownloadModal = ({ filename }) => {
  const handleDownload = async () => {
    try {
      await triggerBrowserDownload(DEMO_PDF_URL, filename);
    } catch (e) {
      ModalManager.error?.({ title: "Error", message: "No fue posible descargar el PDF." });
    }
  };

  ModalManager.custom({
    title: "Descargar Minuta (PDF)",
    size: "xlarge",
    showFooter: false,
    content: (
      <div className="p-6 space-y-4">
        <ActionButton
          label={filename}
          variant="soft"
          size="sm"
          icon={<Icon name="download" />}
          onClick={handleDownload}
          tooltip="Descargar PDF"
          className="mt-2 w-full text-center !px-4"
        />
        <div className="border border-secondary-200 dark:border-secondary-700/60 rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
          <div className="px-4 py-2 border-b border-secondary-200 dark:border-secondary-700/60 text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
            <Icon name="eye" />
            Vista previa
          </div>
          <div className="w-full h-[60vh]">
            <iframe src={DEMO_PDF_URL} title="Vista previa PDF" className="w-full h-full" />
          </div>
        </div>
      </div>
    ),
  });
};

const showConfirmPublishModal = async ({ minuteId, onConfirm }) => {
  try {
    const confirmed = await ModalManager.confirm({
      title: "Publicar minuta",
      message:
        "Al publicar, la minuta quedará en estado Completada y no podrá ser modificada nuevamente.\n\n" +
        "Esta acción indica que los participantes han aprobado el contenido (aprobación tácita) " +
        "y el documento se considera oficial.",
      confirmText: "Publicar minuta",
      cancelText: "Cancelar",
    });

    if (confirmed) {
      onConfirm?.(minuteId);
      // TODO: llamar API para actualizar estado a 'completed'
      console.log("Minuta publicada:", minuteId);
    }
  } catch (error) {
    console.log("Modal cancelado", error);
  }
};

const showConfirmCancelModal = ({ minuteId, currentUser = "Usuario", onConfirm }) => {
  // Estado interno del formulario — manejado con refs para no re-renderizar el modal
  let motivoValue = "";

  const handleSubmit = () => {
    if (!motivoValue.trim()) {
      // Resaltar campo vacío via DOM directo (el modal no re-renderiza)
      const input = document.getElementById("cancel-motivo-input");
      if (input) {
        input.focus();
        input.classList.add("!border-red-500", "!ring-red-500/20");
      }
      const error = document.getElementById("cancel-motivo-error");
      if (error) error.classList.remove("hidden");
      return;
    }
    ModalManager.closeAll?.();
    onConfirm?.(minuteId, motivoValue.trim());
    console.log("Minuta anulada:", minuteId, "| Motivo:", motivoValue.trim());
  };

  ModalManager.custom({
    title: "Anular minuta",
    size: "small",
    showFooter: false,
    content: (
      <div className="p-6 space-y-5">

        {/* Advertencia */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-700/40">
          <Icon name="FaTriangleExclamation" className="text-red-500 dark:text-red-400 mt-0.5 shrink-0 text-sm" />
          <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
            La minuta pasará a estado <strong>Anulada</strong> y no podrá ser editada ni descargada.
            El registro quedará visible en el sistema para fines de trazabilidad.
          </p>
        </div>

        {/* Campo: Usuario (solo lectura) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Usuario
          </label>
          <input
            type="text"
            value={currentUser}
            readOnly
            className="
              w-full px-3 py-2 rounded-lg text-sm
              border border-gray-200 dark:border-gray-700
              bg-gray-50 dark:bg-gray-800/60
              text-gray-500 dark:text-gray-400
              cursor-not-allowed select-none
            "
          />
        </div>

        {/* Campo: Motivo (obligatorio) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Motivo <span className="text-red-500">*</span>
          </label>
          <textarea
            id="cancel-motivo-input"
            rows={3}
            placeholder="Describe el motivo de la anulación..."
            onChange={(e) => {
              motivoValue = e.target.value;
              // Limpiar error al escribir
              const error = document.getElementById("cancel-motivo-error");
              if (error) error.classList.add("hidden");
              e.target.classList.remove("!border-red-500", "!ring-red-500/20");
            }}
            className="
              w-full px-3 py-2 rounded-lg text-sm resize-none
              border border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-800
              text-gray-800 dark:text-gray-200
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10
              transition-colors
            "
          />
          <p id="cancel-motivo-error" className="hidden text-xs text-red-500 mt-1">
            El motivo es obligatorio para anular la minuta.
          </p>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => ModalManager.closeAll?.()}
            className="
              flex-1 px-4 py-2 rounded-lg text-sm font-medium
              border border-gray-200 dark:border-gray-700
              text-gray-600 dark:text-gray-400
              hover:bg-gray-50 dark:hover:bg-gray-700/50
              transition-colors
            "
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="
              flex-1 px-4 py-2 rounded-lg text-sm font-medium
              bg-red-500 hover:bg-red-600 active:bg-red-700
              text-white transition-colors
            "
          >
            Anular minuta
          </button>
        </div>

      </div>
    ),
  });
};

// ====================================
// SUBCOMPONENTE: CardHeader
// ====================================
const CardHeader = ({ minute, statusConfig }) => {
  const title = String(minute?.title ?? "");
  const numberIndex = 25;
  const titleUi = title.length > numberIndex ? `${title.slice(0, numberIndex + 3)}...` : title;

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
            <Icon name={statusConfig.icon} />
            {statusConfig.label}
          </div>
        </div>
      </div>
    </div>
  );
};

// ====================================
// SUBCOMPONENTE: CardBody
// ====================================
const CardBody = ({ minute }) => {
  const participants = safeArray(minute?.participants);
  const tags = safeArray(minute?.tags);

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
        {minute?.summary ?? "-"}
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag, idx) => {
          const colorClass = TAG_COLORS?.[tag?.color] ?? TAG_COLORS.blue;
          return (
            <span key={idx} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-theme ${colorClass}`}>
              {tag?.label ?? "Etiqueta"}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ====================================
// SUBCOMPONENTE: CardFooter
//
// Flujo de estados:
//   in-progress → ready-for-edit → pending → completed
//   Cualquier estado (excepto completed) puede ir a cancelled
//
// Descripción de estados:
//   in-progress    → Minuta enviada al agente IA, procesando en background
//   ready-for-edit → IA devolvió resultado, usuario debe revisar/corregir/validar
//   pending        → Usuario envió a participantes, aprobación tácita en curso
//   completed      → Minuta oficial aprobada, inmutable, solo descarga
//   cancelled      → Anulada, visible solo para trazabilidad, sin acciones
//
// Acciones por estado:
//   in-progress    → [———]    [———]       [Anular]
//   ready-for-edit → [Editar] [———]       [Anular]
//   pending        → [Editar] [Publicar]  [Anular]
//   completed      → [———]    [Descargar] [———]
//   cancelled      → (sin acciones — footer reducido)
//
// Estilo de botones:
//   Todos igual: borde gris, icono gray-500, sin fondo en reposo
//   Hover estándar → fondo blue-50,  icono+texto blue-600
//   Hover Anular   → fondo red-50,   icono+texto red-600
//   Deshabilitado  → opacidad 35%, cursor not-allowed, sin hover
// ====================================

// Clases base compartidas por todos los botones del footer
const BTN_BASE = [
  "flex items-center justify-center gap-1.5 w-full",
  "px-3 py-2 rounded-lg text-xs font-medium",
  "border border-gray-200 dark:border-gray-700",
  "text-gray-500 dark:text-gray-400",
  "bg-transparent",
  "transition-all duration-150",
  "select-none relative group",
  "focus:outline-none",
].join(" ");

const BTN_HOVER_DEFAULT = [
  "cursor-pointer",
  "hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200",
  "dark:hover:bg-blue-900/20 dark:hover:text-blue-400 dark:hover:border-blue-700",
].join(" ");

const BTN_HOVER_DANGER = [
  "cursor-pointer",
  "hover:bg-red-50 hover:text-red-600 hover:border-red-200",
  "dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-700",
].join(" ");

const BTN_DISABLED = [
  "opacity-40 cursor-not-allowed",
  "hover:bg-gray-50 hover:text-gray-400 hover:border-gray-300",
  "dark:hover:bg-gray-800/40 dark:hover:text-gray-500 dark:hover:border-gray-600",
].join(" ");

const FooterBtn = ({ icon, tooltip, onClick, disabled = false, danger = false }) => {
  const hoverClass = danger ? BTN_HOVER_DANGER : BTN_HOVER_DEFAULT;
  const stateClass = disabled ? BTN_DISABLED : hoverClass;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`${BTN_BASE} ${stateClass}`}
    >
      {icon}

      {/* Tooltip — bottom-full + translate para posicionarse justo sobre el botón
           left-0 + max-w para no salirse del viewport en botones del borde */}
      <span className="
        pointer-events-none
        absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2
        px-2.5 py-1.5 rounded-lg
        bg-gray-800 dark:bg-gray-700
        text-white text-xs font-normal leading-snug
        w-max max-w-[180px] text-center
        opacity-0 group-hover:opacity-100
        transition-opacity duration-150
        z-[9999]
        shadow-lg
      ">
        {tooltip}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-800 dark:border-t-gray-700" />
      </span>
    </button>
  );
};

const CardFooter = ({ minute, onStatusChange }) => {
  const navigate = useNavigate();

  const minuteId = minute?.id;
  const status = String(minute?.status ?? "in-progress");

  const isInProgress   = status === "in-progress";
  const isReadyForEdit = status === "ready-for-edit";
  const isPending      = status === "pending";
  const isCompleted    = status === "completed";
  const isCancelled    = status === "cancelled";

  const filename = buildMinuteFilename(minute?.title, minute?.date);

  const handleEdit     = () => { if (minuteId) navigate(`/minutes/process/${minuteId}`); };
  const handlePublish  = () => { showConfirmPublishModal({ minuteId, onConfirm: (id) => onStatusChange?.(id, "completed") }); };
  const handleCancel   = () => { showConfirmCancelModal({ minuteId, onConfirm: (id) => onStatusChange?.(id, "cancelled") }); };
  const handleDownload = () => { showDownloadModal({ filename }); };

  // Cancelled — footer mínimo sin acciones
  if (isCancelled) {
    return (
      <div className="px-4 py-3 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme flex items-center justify-center">
        <span className="text-xs text-gray-400 dark:text-gray-500 italic">Sin acciones disponibles</span>
      </div>
    );
  }

  // Reglas de disponibilidad por estado
  const canEdit     = isReadyForEdit || isPending;
  const canPublish  = isPending;
  const canDownload = isCompleted;
  const canCancel   = isInProgress || isReadyForEdit || isPending || isCompleted;

  const tooltipEdit = canEdit
    ? "Editar minuta"
    : isInProgress
      ? "La minuta aún está siendo procesada por la IA"
      : isCompleted
        ? "La minuta está completada y no se puede editar"
        : "La minuta fue anulada";

  const tooltipPublish = canPublish
    ? "Publicar minuta — pasará a Completada (acción irreversible)"
    : isCompleted
      ? "La minuta ya fue publicada"
      : isInProgress
        ? "Primero debe completarse el procesamiento de IA"
        : isReadyForEdit
          ? "Primero debes revisar y enviar la minuta a los participantes"
          : "La minuta fue anulada";

  const tooltipDownload = canDownload
    ? "Descargar minuta en PDF"
    : isInProgress
      ? "El PDF estará disponible una vez publicada la minuta"
      : isCancelled
        ? "No se puede descargar una minuta anulada"
        : "El PDF estará disponible una vez publicada la minuta";

  const tooltipCancel = canCancel
    ? "Anular minuta — quedará visible solo para trazabilidad"
    : "La minuta ya fue anulada";

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

        {/* PUBLICAR */}
        <FooterBtn
          icon={<Icon name="checkCircle" />}
          tooltip={tooltipPublish}
          onClick={handlePublish}
          disabled={!canPublish}
        />

        {/* DESCARGAR */}
        <FooterBtn
          icon={<Icon name="download" />}
          tooltip={tooltipDownload}
          onClick={handleDownload}
          disabled={!canDownload}
        />

        {/* ANULAR */}
        <FooterBtn
          icon={<Icon name="ban" />}
          tooltip={tooltipCancel}
          onClick={handleCancel}
          disabled={!canCancel}
          danger
        />

      </div>
    </div>
  );
};
// ====================================
// COMPONENTE PRINCIPAL
// ====================================
const MinuteCard = ({ minute, onStatusChange }) => {
  const status = String(minute?.status ?? "in-progress");
  const statusConfig = getStatusConfig(status);

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