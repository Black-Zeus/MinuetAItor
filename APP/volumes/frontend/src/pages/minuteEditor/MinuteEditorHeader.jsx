/**
 * pages/minuteEditor/MinuteEditorHeader.jsx
 *
 * Header del editor de minutas — no sticky, flujo de estados integrado.
 * Absorbe la lógica de MinuteEditorStatusPanel (que queda eliminado).
 *
 * LÓGICA DE ESTADOS:
 *
 *   ready-for-edit  → editor activo, botón "Guardar"
 *                     Al guardar: transitionMinute(pending) → saveMinuteDraft
 *                     (el backend crea draft_current.json en la transición;
 *                      el save posterior persiste los cambios del editor)
 *
 *   pending         → editor activo, split button:
 *                       · "Guardar"                    → saveMinuteDraft
 *                       · "Guardar y enviar a revisión" → saveMinuteDraft + transitionMinute(preview)
 *
 *   preview         → solo lectura, botones de decisión:
 *                       · "Aprobar y publicar"  → transitionMinute(completed)
 *                       · "Devolver a edición"  → transitionMinute(pending)
 *
 *   completed       → solo lectura, solo PDF
 *   cancelled       → solo lectura, sin acciones
 *
 *   Cancelar minuta → siempre en menú "..." para estados cancellable
 *   Rollback        → visible solo si isDirty en estado editable
 *
 * PROPS:
 *   recordMeta          { id, status, pdfUrl? }
 *   isReadOnly          boolean
 *   onTransitionSuccess (newStatus: string) => void
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@components/ui/icon/iconManager";
import useMinuteEditorStore from "@/store/minuteEditorStore";
import ModalManager from "@components/ui/modal";
import ActionButton from "@/components/ui/button/ActionButton";
import { saveMinuteDraft, transitionMinute } from "@/services/minutesService";
import { toastSuccess, toastError } from "@/components/common/toast/toastHelpers";

import logger from "@/utils/logger";
const log = logger.scope("minute-editor-header");

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META = {
  "in-progress":      { label: "En procesamiento",  color: "blue"   },
  "ready-for-edit":   { label: "Listo para editar", color: "orange" },
  "pending":          { label: "En edición",        color: "yellow" },
  "preview":          { label: "En revisión",       color: "indigo" },
  "completed":        { label: "Completado",        color: "green"  },
  "cancelled":        { label: "Cancelado",         color: "gray"   },
  "llm-failed":       { label: "Fallo IA",          color: "red"    },
  "processing-error": { label: "Error de proceso",  color: "red"    },
};

const BADGE_COLORS = {
  blue:   "bg-blue-50   dark:bg-blue-900/20   text-blue-700   dark:text-blue-300   border-blue-200/60   dark:border-blue-700/50",
  orange: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200/60 dark:border-orange-700/50",
  yellow: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200/60 dark:border-yellow-700/50",
  indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-700/50",
  green:  "bg-green-50  dark:bg-green-900/20  text-green-700  dark:text-green-300  border-green-200/60  dark:border-green-700/50",
  gray:   "bg-gray-100  dark:bg-gray-800      text-gray-600   dark:text-gray-400   border-gray-200/60   dark:border-gray-700/50",
  red:    "bg-red-50    dark:bg-red-900/20    text-red-700    dark:text-red-300    border-red-200/60    dark:border-red-700/50",
};

const CANCELLABLE = new Set(["ready-for-edit", "pending", "preview", "in-progress"]);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const buildFilename = (subject, dateMeeting) => {
  const rawTitle = String(subject ?? "").trim() || "minuta";
  const safeTitle =
    rawTitle
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "minuta";

  const s = String(dateMeeting ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m
    ? { yyyy: m[1], mm: m[2], dd: m[3] }
    : (() => {
        const now = new Date();
        const p   = (n) => String(n).padStart(2, "0");
        return { yyyy: String(now.getFullYear()), mm: p(now.getMonth() + 1), dd: p(now.getDate()) };
      })();

  return `${d.yyyy}${d.mm}${d.dd}_${safeTitle}.pdf`;
};

const triggerBrowserDownload = async (url, filename) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Error al descargar PDF (${res.status})`);
  const blob      = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a         = document.createElement("a");
  a.href          = objectUrl;
  a.download      = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] ?? { label: status ?? "—", color: "gray" };
  const dotClass = {
    yellow: "bg-yellow-500", green:  "bg-green-500",  orange: "bg-orange-500",
    blue:   "bg-blue-500",   indigo: "bg-indigo-500", red:    "bg-red-500",
    gray:   "bg-gray-400",
  }[meta.color] ?? "bg-gray-400";

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-theme ${BADGE_COLORS[meta.color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      {meta.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: CONFIRMACIÓN DE TRANSICIÓN GENÉRICA
// ─────────────────────────────────────────────────────────────────────────────

const TransitionModalContent = ({ transition, currentStatus, onConfirm, onCancel }) => {
  const [observation, setObservation] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);

  const fromMeta = STATUS_META[currentStatus]     ?? { label: currentStatus,     color: "gray" };
  const toMeta   = STATUS_META[transition.target] ?? { label: transition.target, color: "gray" };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(transition.target, observation.trim() || null);
    } catch (err) {
      setError(err?.message ?? "Error al ejecutar la transición.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Flecha de transición */}
      <div className="flex items-center justify-center gap-3 py-1">
        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border transition-theme ${BADGE_COLORS[fromMeta.color]}`}>
          {fromMeta.label}
        </span>
        <Icon name="arrowRight" className="text-gray-400 dark:text-gray-500" />
        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border transition-theme ${BADGE_COLORS[toMeta.color]}`}>
          {toMeta.label}
        </span>
      </div>

      {/* Descripción */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 transition-theme">
        <Icon name="circleInfo" className="text-primary-500 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed transition-theme">
          {transition.description}
        </p>
      </div>

      {/* Observación */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 transition-theme">
          Observación <span className="normal-case font-normal text-gray-400">(opcional)</span>
        </label>
        <textarea
          rows={3}
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          placeholder="Agrega una nota sobre este cambio de estado…"
          disabled={submitting}
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700
            text-sm text-gray-900 dark:text-gray-100 transition-theme resize-none
            focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50"
        />
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 transition-theme">
          Quedará registrada en la línea de tiempo de la versión generada.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-700/40 transition-theme">
          <Icon name="triangleExclamation" className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-300 transition-theme">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-1 border-t border-gray-100 dark:border-gray-700/50 transition-theme">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
            text-gray-800 dark:text-gray-200 text-sm font-semibold transition-theme disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold shadow-md transition-all disabled:opacity-50
            ${transition.style === "success" ? "bg-green-600 hover:bg-green-700 text-white"  :
              transition.style === "warning" ? "bg-amber-500 hover:bg-amber-600 text-white"  :
              transition.style === "danger"  ? "bg-red-600   hover:bg-red-700   text-white"  :
                                              "bg-primary-600 hover:bg-primary-700 text-white"}`}
        >
          {submitting
            ? <><i className="fas fa-spinner fa-spin text-sm" /> Procesando…</>
            : <><Icon name={transition.icon} /> {transition.label}</>
          }
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: GUARDAR Y ENVIAR A REVISIÓN
// ─────────────────────────────────────────────────────────────────────────────

const SendToReviewModalContent = ({ onConfirm, onCancel }) => {
  const [observation, setObservation] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(observation.trim() || null);
    } catch (err) {
      setError(err?.message ?? "Error al enviar a revisión.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-center gap-3 py-1">
        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border transition-theme ${BADGE_COLORS.yellow}`}>
          En edición
        </span>
        <Icon name="arrowRight" className="text-gray-400 dark:text-gray-500" />
        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border transition-theme ${BADGE_COLORS.indigo}`}>
          En revisión
        </span>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 transition-theme">
        <Icon name="circleInfo" className="text-primary-500 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed transition-theme">
          Se guardará el contenido actual, se generará un snapshot de la versión y se encolará el PDF borrador con marca de agua <strong>BORRADOR</strong>.
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 transition-theme">
          Observación <span className="normal-case font-normal text-gray-400">(opcional)</span>
        </label>
        <textarea
          rows={3}
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          placeholder="Agrega una nota sobre esta versión para el revisor…"
          disabled={submitting}
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700
            text-sm text-gray-900 dark:text-gray-100 transition-theme resize-none
            focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-700/40 transition-theme">
          <Icon name="triangleExclamation" className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-300 transition-theme">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-1 border-t border-gray-100 dark:border-gray-700/50 transition-theme">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
            text-gray-800 dark:text-gray-200 text-sm font-semibold transition-theme disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold shadow-md transition-all disabled:opacity-50
            bg-primary-600 hover:bg-primary-700 text-white"
        >
          {submitting
            ? <><i className="fas fa-spinner fa-spin text-sm" /> Guardando y enviando…</>
            : <><Icon name="paperPlane" /> Guardar y enviar</>
          }
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: ROLLBACK
// ─────────────────────────────────────────────────────────────────────────────

const RollbackModalContent = ({ changes = [] }) => (
  <div className="space-y-4">
    <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
      Se descartarán las modificaciones actuales y el editor volverá al último estado guardado.
    </p>

    {changes.length === 0 ? (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-theme">
        <p className="text-sm text-gray-700 dark:text-gray-200 transition-theme">
          No se detectaron diferencias normalizadas. Si sigues viendo cambios en pantalla,
          pueden existir estados locales en subcomponentes (inputs no controlados, acordeones, etc.).
        </p>
      </div>
    ) : (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-theme">
        <div className="max-h-[50vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-theme">
              <tr className="text-left">
                <th className="p-3 font-semibold text-gray-700 dark:text-gray-200">Sección</th>
                <th className="p-3 font-semibold text-gray-700 dark:text-gray-200">Campo</th>
                <th className="p-3 font-semibold text-gray-700 dark:text-gray-200">Antes</th>
                <th className="p-3 font-semibold text-gray-700 dark:text-gray-200">Después</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 transition-theme">
              {changes.map((c, idx) => (
                <tr key={idx} className="align-top">
                  <td className="p-3 whitespace-nowrap text-gray-800 dark:text-gray-100 transition-theme">{c.section}</td>
                  <td className="p-3 whitespace-nowrap text-gray-700 dark:text-gray-200 transition-theme">{c.field}</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300 transition-theme"><div className="whitespace-pre-wrap break-words">{c.before || "—"}</div></td>
                  <td className="p-3 text-gray-600 dark:text-gray-300 transition-theme"><div className="whitespace-pre-wrap break-words">{c.after || "—"}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}

    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-700/40 transition-theme">
      <Icon name="triangleExclamation" className="text-red-600 shrink-0 mt-0.5" />
      <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed transition-theme">
        Esta acción no puede deshacerse. Los cambios no guardados se perderán.
      </p>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT BUTTON "GUARDAR"
// ─────────────────────────────────────────────────────────────────────────────

const SaveButton = ({ status, saving, onSaveDraft, onSaveAndReview }) => {
  const [ddlOpen, setDdlOpen] = useState(false);

  // ready-for-edit: botón simple
  if (status === "ready-for-edit") {
    return (
      <button
        type="button"
        onClick={onSaveDraft}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-60
          bg-primary-600 hover:bg-primary-700 text-white"
      >
        {saving
          ? <><i className="fas fa-spinner fa-spin text-sm" /> Guardando…</>
          : <><Icon name="floppyDisk" className="text-sm" /> Guardar</>
        }
      </button>
    );
  }

  // pending: split button
  if (status === "pending") {
    return (
      <div className="relative flex items-stretch">
        {/* Parte principal: guardar borrador */}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving}
          className="flex items-center gap-2 pl-4 pr-3 py-2 rounded-l-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-60
            bg-primary-600 hover:bg-primary-700 text-white border-r border-primary-700/50"
        >
          {saving
            ? <><i className="fas fa-spinner fa-spin text-sm" /> Guardando…</>
            : <><Icon name="floppyDisk" className="text-sm" /> Guardar</>
          }
        </button>

        {/* Parte DDL: flecha */}
        <button
          type="button"
          onClick={() => setDdlOpen((v) => !v)}
          disabled={saving}
          className="flex items-center justify-center px-2.5 py-2 rounded-r-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-60
            bg-primary-600 hover:bg-primary-700 text-white"
          title="Más opciones"
        >
          <Icon name="chevronDown" className="text-xs" />
        </button>

        {ddlOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDdlOpen(false)} />
            <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[230px] rounded-xl border border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-800 shadow-lg overflow-hidden transition-theme">
              <button
                type="button"
                onClick={() => { setDdlOpen(false); onSaveAndReview(); }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-theme"
              >
                <Icon name="paperPlane" className="text-primary-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme">
                    Guardar y enviar a revisión
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-theme">
                    Genera snapshot y PDF borrador con marca de agua
                  </p>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

const MinuteEditorHeader = ({ recordMeta, isReadOnly, onTransitionSuccess }) => {
  const navigate = useNavigate();
  const [saving,   setSaving]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    meetingInfo = {},
    isDirty,
    markClean,
    getExportPayload,
    getChangesSinceSnapshot,
    rollbackToSnapshot,
    takeSnapshot,
  } = useMinuteEditorStore();

  const recordId = recordMeta?.id;
  const status   = recordMeta?.status;
  const pdfUrl   = recordMeta?.pdfUrl ?? null;
  const filename = buildFilename(meetingInfo.subject, meetingInfo?.meetingDate);

  const clientName = (meetingInfo.client  ?? "").trim() || "Cliente no definido";
  const subject    = (meetingInfo.subject ?? "").trim() || "Sin asunto";

  const isEditable       = !isReadOnly;
  const showSaveBtn      = isEditable && (status === "ready-for-edit" || status === "pending");
  const showPreviewBtns  = status === "preview";
  const showCancelOption = CANCELLABLE.has(status);

  // ── Guardar borrador ────────────────────────────────────────────────────────
  // Para ready-for-edit: el backend crea draft_current.json DURANTE la transición
  // (copia el schema_output_v1.json). Por eso el orden es:
  //   1. transitionMinute(pending)  → estado cambia, draft_current.json creado
  //   2. saveMinuteDraft(payload)   → persiste los cambios del editor sobre el draft
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = getExportPayload();

      if (status === "ready-for-edit") {
        await transitionMinute(recordId, "pending");
        await saveMinuteDraft(recordId, payload);
        markClean(new Date().toISOString());
        takeSnapshot?.();
        onTransitionSuccess?.("pending");
      } else {
        // pending: solo guardar draft
        await saveMinuteDraft(recordId, payload);
        markClean(new Date().toISOString());
        takeSnapshot?.();
      }
    } catch (err) {
      log.error("Error al guardar:", err);
      ModalManager.error({
        title: "Error al guardar",
        message: err?.message ?? "No fue posible guardar el borrador. Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Guardar y enviar a revisión (pending → preview) ─────────────────────────
  const handleSaveAndReview = () => {
    ModalManager.custom({
      title: "Guardar y enviar a revisión",
      size: "medium",
      showFooter: false,
      content: (
        <SendToReviewModalContent
          onCancel={() => ModalManager.close()}
          onConfirm={async (observation) => {
            const payload = getExportPayload();
            await saveMinuteDraft(recordId, payload);
            await transitionMinute(recordId, "preview", observation);
            markClean(new Date().toISOString());
            takeSnapshot?.();
            ModalManager.closeAll?.();
            toastSuccess("Enviado a revisión", "La minuta fue guardada y enviada a revisión correctamente.");
            onTransitionSuccess?.("preview");
          }}
        />
      ),
    });
  };

  // ── Transición genérica (preview → completed / pending, y cancel) ──────────
  const handleTransitionClick = (transition) => {
    setMenuOpen(false);
    ModalManager.custom({
      title: transition.label,
      size: "medium",
      showFooter: false,
      content: (
        <TransitionModalContent
          transition={transition}
          currentStatus={status}
          onCancel={() => ModalManager.close()}
          onConfirm={async (targetStatus, observation) => {
            await transitionMinute(recordId, targetStatus, observation);
            ModalManager.closeAll?.();
            const toastMap = {
              completed: ["Minuta publicada",    "La minuta fue aprobada y publicada correctamente."],
              pending:   ["Devuelta a edición",  "La minuta fue devuelta a edición activa."],
              cancelled: ["Minuta cancelada",    "La minuta fue cancelada correctamente."],
            };
            const [title, msg] = toastMap[targetStatus] ?? ["Transición completada", `Estado actualizado a '${targetStatus}'.`];
            toastSuccess(title, msg);
            onTransitionSuccess?.(targetStatus);
          }}
        />
      ),
    });
  };

  // ── Rollback ────────────────────────────────────────────────────────────────
  const handleRollback = () => {
    const changes = getChangesSinceSnapshot?.() ?? [];
    ModalManager.custom({
      title: "Descartar cambios",
      size: "xlarge",
      showFooter: true,
      content: <RollbackModalContent changes={changes} />,
      buttons: [
        { text: "Cancelar", variant: "secondary", onClick: () => ModalManager.hide?.() },
        {
          text: "Confirmar rollback",
          variant: "primary",
          onClick: () => {
            rollbackToSnapshot?.();
            ModalManager.hide?.();
            ModalManager.custom({
              title: "Rollback aplicado",
              size: "small",
              showFooter: false,
              content: (
                <div className="p-1">
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/15 border border-green-200/60 dark:border-green-700/40 transition-theme">
                    <Icon name="check" className="text-green-600 shrink-0" />
                    <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed transition-theme">
                      El editor volvió al último estado guardado. Los cambios fueron descartados.
                    </p>
                  </div>
                </div>
              ),
              onClose: () => ModalManager.closeAll?.(),
            });
          },
        },
      ],
    });
  };

  // ── Descargar PDF ───────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    if (!pdfUrl) {
      ModalManager.custom({
        title: "PDF no disponible",
        size: "small",
        showFooter: true,
        content: (
          <div className="p-1">
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 transition-theme">
              <Icon name="fileLines" className="text-gray-400 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed transition-theme">
                El PDF aún no ha sido generado. Estará disponible una vez que el worker PDF complete el proceso.
              </p>
            </div>
          </div>
        ),
        buttons: [{ text: "Entendido", variant: "primary", onClick: () => ModalManager.hide?.() }],
      });
      return;
    }
    showDownloadModal(pdfUrl, filename);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <header className="border-b border-gray-200 dark:border-gray-800  transition-theme">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

        {/* ── IZQUIERDA: navegación + título + estado ── */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">            

            <h1 className="text-base md:text-lg font-bold text-gray-900 mt-0.5 ml-9  dark:text-white transition-theme truncate max-w-sm md:max-w-lg">
              {clientName}
            </h1>

            {status && <StatusBadge status={status} />}
          </div>

          <p className="mt-0.5 ml-9 text-sm text-gray-500 dark:text-gray-400 transition-theme truncate max-w-xl">
            {subject}
          </p>
        </div>

        {/* ── DERECHA: acciones ── */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">

          {/* Acciones de revisión — estado preview */}
          {showPreviewBtns && (
            <>
              <button
                type="button"
                onClick={() => handleTransitionClick({
                  target:      "completed",
                  label:       "Aprobar y publicar",
                  icon:        "circleCheck",
                  style:       "success",
                  description: "Marca esta versión como final y encola el PDF de publicación sin marca de agua.",
                })}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all
                  bg-green-600 hover:bg-green-700 text-white"
              >
                <Icon name="circleCheck" className="text-xs" />
                Aprobar y publicar
              </button>

              <button
                type="button"
                onClick={() => handleTransitionClick({
                  target:      "pending",
                  label:       "Devolver a edición",
                  icon:        "rotate",
                  style:       "warning",
                  description: "Devuelve la minuta a edición activa sin perder el borrador actual.",
                })}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all
                  bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Icon name="rotate" className="text-xs" />
                Devolver a edición
              </button>

              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 transition-theme shrink-0" />
            </>
          )}

          {/* Rollback — solo si hay cambios sin guardar en estado editable */}
          {isEditable && isDirty && (
            <button
              type="button"
              onClick={handleRollback}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-semibold transition-theme
                bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20
                border-gray-200 dark:border-gray-700 text-red-600 dark:text-red-400"
              title="Descartar cambios no guardados"
            >
              <Icon name="rotateLeft" className="text-xs" />
              Rollback
            </button>
          )}

          {/* Guardar (simple o split) */}
          {showSaveBtn && (
            <SaveButton
              status={status}
              saving={saving}
              onSaveDraft={handleSaveDraft}
              onSaveAndReview={handleSaveAndReview}
            />
          )}

          {/* Descargar PDF */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            title={!pdfUrl ? "PDF pendiente de generación" : "Descargar PDF"}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-semibold transition-theme
              ${!pdfUrl
                ? "bg-gray-100 dark:bg-gray-700/60 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
              }`}
          >
            <Icon name="download" className="text-xs" />
            PDF
            {!pdfUrl && <Icon name="lock" className="text-[9px] opacity-40" />}
          </button>

          {/* Menú "..." — acciones críticas (Cancelar minuta) */}
          {showCancelOption && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-700
                  bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                  text-gray-500 dark:text-gray-400 transition-theme"
                title="Más acciones"
              >
                <Icon name="ellipsisVertical" className="text-sm" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[190px] rounded-xl border border-gray-200 dark:border-gray-700
                    bg-white dark:bg-gray-800 shadow-lg overflow-hidden transition-theme">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700/50">
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Acciones críticas
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTransitionClick({
                        target:      "cancelled",
                        label:       "Cancelar minuta",
                        icon:        "ban",
                        style:       "danger",
                        description: "Anula definitivamente la minuta. Solo un administrador puede revertir esta acción.",
                      })}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-theme
                        text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Icon name="ban" className="text-xs shrink-0" />
                      Cancelar minuta
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default MinuteEditorHeader;