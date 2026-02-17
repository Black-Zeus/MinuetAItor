/**
 * pages/minuteEditor/cards/MinuteEditorCardMeeting.jsx
 * Card: Información de la reunión
 * - NO editables: Proyecto (derivado), Cliente, Ubicación, Preparado por
 * - Editables: Fecha (type="date" con normalización), Asunto (textarea 4 filas)
 *
 * Normaliza meetingDate para input date:
 *   - acepta "YYYY-MM-DD"
 *   - acepta "DD/MM/YYYY"
 *   - (fallback) intenta "DD-MM-YYYY"
 */

import React, { useMemo, useState } from "react";
import Icon from "@components/ui/icon/iconManager";
import useMinuteEditorStore from "@/store/minuteEditorStore";

const ReadRow = ({ label, value }) => {
  const v = (value ?? "").toString().trim();
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-500 dark:text-gray-400 transition-theme shrink-0">
        {label}
      </span>
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme text-right max-w-xs truncate">
        {v ? v : <span className="text-gray-400 dark:text-gray-600 italic">—</span>}
      </span>
    </div>
  );
};

// ---- Normalización de fecha ----
// Retorna YYYY-MM-DD o "" si no puede parsear
const normalizeDateForInput = (raw) => {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim();

  // YYYY-MM-DD (ideal)
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // DD/MM/YYYY
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // DD-MM-YYYY (por si acaso)
  m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  return "";
};

// Muestra siempre en DD/MM/YYYY si se puede
const formatDateForView = (raw) => {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim();

  // YYYY-MM-DD -> DD/MM/YYYY
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  // DD/MM/YYYY -> DD/MM/YYYY
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return s;

  // DD-MM-YYYY -> DD/MM/YYYY
  m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;

  return s;
};

export const MinuteEditorCardMeeting = () => {
  const { meetingInfo, updateMeetingInfo, pdfFormat } = useMinuteEditorStore();
  const [editing, setEditing] = useState(false);

  // Proyecto derivado (tu store no tiene meetingInfo.project; está en pdfFormat.coverPage.projectName)
  const projectName = pdfFormat?.coverPage?.projectName ?? "";

  const meetingDateInputValue = useMemo(
    () => normalizeDateForInput(meetingInfo.meetingDate),
    [meetingInfo.meetingDate]
  );

  const meetingDateViewValue = useMemo(
    () => formatDateForView(meetingInfo.meetingDate),
    [meetingInfo.meetingDate]
  );

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wider text-gray-800 dark:text-gray-200 uppercase transition-theme">
          Información de la reunión
        </h2>

        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-theme text-sm"
        >
          <Icon name={editing ? "lock" : "edit"} className="mr-2" />
          {editing ? "Bloquear" : "Editar"}
        </button>
      </div>

      <div className="mt-5 space-y-4 flex-1">
        {/* 1) No editables - arriba */}
        <ReadRow label="Cliente" value={meetingInfo.client} />
        <ReadRow label="Proyecto" value={projectName} />
        <ReadRow label="Ubicación" value={meetingInfo.location} />
        <ReadRow label="Preparado por" value={meetingInfo.preparedBy} />

        {/* 2) Fecha - al final (editable) */}
        <div className="flex items-start justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400 transition-theme shrink-0 pt-2">
            Fecha
          </span>

          {editing ? (
            <input
              type="date"
              value={meetingDateInputValue}
              onChange={(e) => updateMeetingInfo("meetingDate", e.target.value)}
              className={[
                "w-full max-w-xs px-3 py-1.5 rounded-lg",
                "bg-gray-50 dark:bg-gray-900",
                "border border-gray-200 dark:border-gray-700",
                "text-gray-900 dark:text-gray-100 text-sm transition-theme",
                "focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-right",
              ].join(" ")}
            />
          ) : (
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme text-right">
              {meetingDateViewValue || (
                <span className="text-gray-400 dark:text-gray-600 italic">—</span>
              )}
            </span>
          )}
        </div>

        {/* 3) Asunto - al final (editable textarea) */}
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400 transition-theme shrink-0 pt-2">
            Asunto
          </span>

          {editing ? (
            <textarea
              rows={4}
              value={meetingInfo.subject ?? ""}
              onChange={(e) => updateMeetingInfo("subject", e.target.value)}
              placeholder="Asunto de la reunión"
              className={[
                "w-full max-w-xs px-3 py-2 rounded-lg",
                "bg-gray-50 dark:bg-gray-900",
                "border border-gray-200 dark:border-gray-700",
                "text-gray-900 dark:text-gray-100 text-sm transition-theme",
                "focus:outline-none focus:ring-2 focus:ring-primary-500/40",
                "resize-none text-right",
              ].join(" ")}
            />
          ) : (
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme text-right whitespace-pre-wrap max-w-xs">
              {meetingInfo.subject || (
                <span className="text-gray-400 dark:text-gray-600 italic">—</span>
              )}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default MinuteEditorCardMeeting;