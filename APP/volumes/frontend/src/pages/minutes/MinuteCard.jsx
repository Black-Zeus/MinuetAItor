// src/pages/minutes/components/MinuteCard.jsx
import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import ModalManager from "@/components/ui/modal";
import { useNavigate } from "react-router-dom";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_BODY = "text-gray-700 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

// ✅ ÚNICA declaración
const DEMO_PDF_URL = "/pdf/demo.pdf";

/**
 * Estados soportados (NO se modifican los existentes):
 * - completed
 * - pending
 * - in-progress
 * - ready-for-edit
 */
const STATUS_CONFIG = {
  completed: {
    label: "Completada",
    icon: "checkCircle",
    className:
      "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200",
  },
  pending: {
    label: "Pendiente",
    icon: "clock",
    className:
      "bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-200",
  },
  "in-progress": {
    label: "En Progreso",
    icon: "spinner",
    className:
      "bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200",
  },
  "ready-for-edit": {
    label: "Lista para edición",
    icon: "edit",
    className:
      "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/20 dark:text-secondary-200",
  },
};

const TAG_COLORS = {
  blue: "bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200",
  green: "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-200",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-200",
  orange: "bg-warm-50 text-warm-700 dark:bg-warm-900/20 dark:text-warm-200",
  red: "bg-danger-50 text-danger-700 dark:bg-danger-900/20 dark:text-danger-200",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200",
};

const safeArray = (v) => (Array.isArray(v) ? v : []);
const getStatusConfig = (status) => STATUS_CONFIG?.[status] ?? STATUS_CONFIG.pending;

// ======================================================
// Helpers (Download + filename)
// ======================================================
/**
 * buildMinuteFilename(subject, dateMeeting)
 * dateMeeting puede venir como:
 * - "YYYY-MM-DD"
 * - "15 Ene 2025" (mes en español abreviado)
 *
 * Salida: yyyymmdd_${safeTitle}.pdf
 */
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

    // 1) "YYYY-MM-DD"
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return { yyyy: m[1], mm: m[2], dd: m[3] };

    // 2) "15 Ene 2025" (día mes año, mes en español)
    // Acepta: ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic (case-insensitive)
    m = s.match(/^(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,})\s+(\d{4})$/);
    if (m) {
      const dd = pad2(m[1]);
      const monRaw = m[2]
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // quita tildes

      const monthMap = {
        ene: "01",
        feb: "02",
        mar: "03",
        abr: "04",
        may: "05",
        jun: "06",
        jul: "07",
        ago: "08",
        sep: "09",
        set: "09", // por si llega "Set"
        oct: "10",
        nov: "11",
        dic: "12",
      };

      const key = monRaw.slice(0, 3);
      const mm = monthMap[key];
      if (mm) return { yyyy: m[3], mm, dd };
    }

    // fallback: fecha actual
    const now = new Date();
    return {
      yyyy: String(now.getFullYear()),
      mm: pad2(now.getMonth() + 1),
      dd: pad2(now.getDate()),
    };
  };

  const d = parseDate(dateMeeting);
  const stamp = `${d.yyyy}${d.mm}${d.dd}`;

  return `${stamp}_${safeTitle}.pdf`;
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

// ======================================================
// Modal: Descargar (preview + nombre como botón)
// ======================================================
const showDownloadModal = ({ filename }) => {
  const handleDownload = async () => {
    try {
      await triggerBrowserDownload(DEMO_PDF_URL, filename);
    } catch (e) {
      console.log("Error descarga PDF:", e);
      ModalManager.error?.({
        title: "Error",
        message: "No fue posible descargar el PDF.",
      });
    }
  };

  ModalManager.custom({
    title: "Descargar Minuta (PDF)",
    size: "xlarge", // si no existe, usa "large"   
    showFooter: false,
    content: (
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">

            {/* ✅ Nombre ahora es botón para descargar */}
            <ActionButton
              label={filename}
              variant="soft"
              size="sm"
              icon={<Icon name="download" />}
              onClick={handleDownload}
              tooltip="Descargar PDF"
              className="mt-2 w-full text-center !px-4"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="border border-secondary-200 dark:border-secondary-700/60 rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
          <div className="px-4 py-2 border-b border-secondary-200 dark:border-secondary-700/60 text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
            <Icon name="eye" />
            Vista previa
          </div>

          <div className="w-full h-[60vh]">
            <iframe
              src={DEMO_PDF_URL}
              title="Vista previa PDF"
              className="w-full h-full"
            />
          </div>
        </div>
      </div>
    ),
  });
};

// ======================================================
// Modal: Confirmar eliminación (async/await)
// ======================================================
const showConfirmDeleteModal = async ({ minuteId }) => {
  try {
    const confirmed = await ModalManager.confirm({
      title: "Confirmar eliminación de minuta",
      message:
        "Esta acción es irreversible: la minuta se eliminará de forma permanente y no podrá recuperarse.\n\n" +
        "La eliminación quedará registrada en la línea de tiempo del proyecto (fecha/hora y usuario) para fines de trazabilidad.",
      confirmText: "Eliminar minuta definitivamente",
      cancelText: "Cancelar",
    });

    if (confirmed) {
      console.log("Usuario confirmó la eliminación", minuteId);
      // TODO: ejecutar delete real aquí
    } else {
      console.log("Usuario canceló", minuteId);
    }
  } catch (error) {
    console.log("Modal cancelado", error);
  }
};

// ======================================================
// Subcomponente: CardHeader
// ======================================================
const CardHeader = ({ minute, statusConfig }) => {
  const title = String(minute?.title ?? "");
  const numberIndex = 25;
  const titleUi =
    title.length > numberIndex ? `${title.slice(0, numberIndex + 3)}...` : title;

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

// ======================================================
// Subcomponente: CardBody
// ======================================================
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
            <span
              className={`px-2.5 py-1 bg-gray-100 dark:bg-gray-800/60 ${TXT_BODY} rounded-lg text-xs font-medium transition-theme`}
            >
              Sin participantes
            </span>
          ) : (
            participants.map((participant, idx) => (
              <span
                key={idx}
                className={`px-2.5 py-1 bg-gray-100 dark:bg-gray-800/60 ${TXT_BODY} rounded-lg text-xs font-medium transition-theme`}
              >
                {participant}
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
            <span
              key={idx}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-theme ${colorClass}`}
            >
              {tag?.label ?? "Etiqueta"}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ======================================================
// Subcomponente: CardFooter (acciones según estado)
// - completed -> descargar
// - pending -> editar, descargar, eliminar
// - in-progress -> nada
// - ready-for-edit -> editar, eliminar
// - se elimina "Ver" y se oculta "Línea de tiempo"
// ======================================================
const CardFooter = ({ minute }) => {
  const navigate = useNavigate();

  const minuteId = minute?.id;
  const status = String(minute?.status ?? "pending");

  const isCompleted = status === "completed";
  const isPending = status === "pending";
  const isInProgress = status === "in-progress";
  const isReadyForEdit = status === "ready-for-edit";

  const allowEdit = isPending || isReadyForEdit;
  const allowDownload = isPending || isCompleted;
  const allowDelete = isPending || isReadyForEdit;

  const tooltipEdit = allowEdit
    ? isPending
      ? "Editar minuta (pendiente)"
      : "Editar minuta (post-IA)"
    : isInProgress
      ? "Edición no disponible: en progreso"
      : "Edición no disponible";

  const tooltipDownload = allowDownload
    ? "Descargar minuta (PDF)"
    : isInProgress
      ? "Descarga no disponible: en progreso"
      : "Descarga no disponible";

  const tooltipDelete = allowDelete
    ? "Eliminar minuta"
    : isInProgress
      ? "Eliminación no disponible: en progreso"
      : "Eliminación no disponible";

  const filename = buildMinuteFilename(minute.title, minute.date);

  const handleEdit = () => {
    if (!allowEdit) return;
    if (!minuteId) return;
    navigate(`/minutes/process/${minuteId}`);
  };

  const handleDownload = () => {
    if (!allowDownload) return;
    showDownloadModal({ filename });
  };

  const handleDelete = async () => {
    if (!allowDelete) return;
    if (!minuteId) return;
    await showConfirmDeleteModal({ minuteId });
  };

  return (
    <div className="p-4 border-t border-secondary-200 dark:border-secondary-700/60 transition-theme min-h-[92px] flex flex-col gap-2">
      {/*
        // OCULTO POR AHORA (para todos)
        <ActionButton
          label="Ver Línea de Tiempo"
          variant="info"
          size="sm"
          icon={<Icon name="history" />}
          onClick={() => console.log("Ver timeline", minuteId)}
          className="w-full"
          tooltip="Revisar Línea de Tiempo"
        />
      */}

      <div className="grid grid-cols-3 gap-2 mt-auto">
        <ActionButton
          variant="soft"
          size="xs"
          icon={<Icon name="edit" />}
          tooltip={tooltipEdit}
          onClick={handleEdit}
          className="w-full"
          disabled={!allowEdit}
        />

        <ActionButton
          variant="soft"
          size="xs"
          icon={<Icon name="download" />}
          tooltip={tooltipDownload}
          onClick={handleDownload}
          className="w-full"
          disabled={!allowDownload}
        />

        <ActionButton
          variant="soft"
          size="xs"
          icon={<Icon name="delete" />}
          tooltip={tooltipDelete}
          onClick={handleDelete}
          className="w-full"
          disabled={!allowDelete}
        />
      </div>
    </div>
  );
};

// ======================================================
// Componente principal
// ======================================================
const MinuteCard = ({ minute }) => {
  const status = String(minute?.status ?? "pending");
  const statusConfig = getStatusConfig(status);

  return (
    <div className="bg-surface rounded-2xl border border-secondary-200 dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5 overflow-hidden transition-all duration-200 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary-500 dark:hover:border-primary-400 h-full flex flex-col">
      <CardHeader minute={minute} statusConfig={statusConfig} />
      <div className="flex-1">
        <CardBody minute={minute} />
      </div>
      <CardFooter minute={minute} />
    </div>
  );
};

export default MinuteCard;