/**
 * pages/minuteEditor/cards/MinuteEditorCardTimes.jsx
 * Card editable: horarios (Programado/Real) + duración derivada.
 * Duración = actualEnd - actualStart (solo horas reales).
 */

import React, { useMemo, useState } from "react";
import Icon from "@components/ui/icon/iconManager";
import useMinuteEditorStore from "@/store/minuteEditorStore";

const TXT_TITLE = "text-gray-900 dark:text-gray-50";
const TXT_MUTED = "text-gray-500 dark:text-gray-400";

const inputBase =
  "w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2";
const inputOk =
  "border-gray-300 dark:border-gray-600 focus:ring-primary-500";
const inputErr =
  "border-red-500 focus:ring-red-500";

const parseHHMM = (val) => {
  if (!val || typeof val !== "string") return null;
  const s = val.trim();
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh * 60 + mm;
};

const formatDuration = (mins) => {
  if (mins == null || !Number.isFinite(mins) || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} min`;
};

const FieldRowRead = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
      {value || "—"}
    </span>
  </div>
);

const SectionTitle = ({ children }) => (
  <div className="pt-2">
    <div className="text-xs font-bold tracking-wider uppercase text-gray-600 dark:text-gray-300">
      {children}
    </div>
  </div>
);

export const MinuteEditorCardTimes = () => {
  const { meetingTimes, updateMeetingTimes } = useMinuteEditorStore();
  const [editing, setEditing] = useState(false);

  // Duración: SOLO real - real
  const durationMinutes = useMemo(() => {
    const start = parseHHMM(meetingTimes.actualStart);
    const end = parseHHMM(meetingTimes.actualEnd);
    if (start == null || end == null) return null;

    let diff = end - start;
    if (diff < 0) diff += 24 * 60; // cruce medianoche
    return diff > 0 ? diff : null;
  }, [meetingTimes.actualStart, meetingTimes.actualEnd]);

  const durationLabel = useMemo(() => formatDuration(durationMinutes), [durationMinutes]);

  // Validación mínima (solo visual)
  const errors = useMemo(() => {
    const e = {};
    if (meetingTimes.actualStart && parseHHMM(meetingTimes.actualStart) == null) {
      e.actualStart = "Formato inválido";
    }
    if (meetingTimes.actualEnd && parseHHMM(meetingTimes.actualEnd) == null) {
      e.actualEnd = "Formato inválido";
    }
    return e;
  }, [meetingTimes.actualStart, meetingTimes.actualEnd]);

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50 h-full flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={`text-xs font-bold tracking-wider uppercase ${TXT_TITLE} transition-theme`}>
            Horarios
          </h2>
          {editing && (
            <p className={`mt-2 text-sm ${TXT_MUTED} transition-theme`}>
              Configure los horarios de la reunión
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-theme text-sm shrink-0"
        >
          <Icon name={editing ? "lock" : "edit"} className="mr-2" />
          {editing ? "Bloquear" : "Editar"}
        </button>
      </div>

      <div className="mt-5 space-y-5 flex-1">
        {/* BLOQUE PROGRAMADO */}
        <div className="space-y-4">
          <SectionTitle>Programado</SectionTitle>

          {editing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora Inicio Programada
                </label>
                <input
                  type="time"
                  value={meetingTimes.scheduledStart ?? ""}
                  onChange={(e) => updateMeetingTimes("scheduledStart", e.target.value)}
                  className={`${inputBase} ${errors.scheduledStart ? inputErr : inputOk}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora Término Programada
                </label>
                <input
                  type="time"
                  value={meetingTimes.scheduledEnd ?? ""}
                  onChange={(e) => updateMeetingTimes("scheduledEnd", e.target.value)}
                  className={`${inputBase} ${errors.scheduledEnd ? inputErr : inputOk}`}
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <FieldRowRead label="Inicio Programado" value={meetingTimes.scheduledStart} />
              <FieldRowRead label="Término Programado" value={meetingTimes.scheduledEnd} />
            </div>
          )}
        </div>

        {/* BLOQUE REAL */}
        <div className="space-y-4">
          <SectionTitle>Real</SectionTitle>

          {editing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora Inicio Real
                </label>
                <input
                  type="time"
                  value={meetingTimes.actualStart ?? ""}
                  onChange={(e) => updateMeetingTimes("actualStart", e.target.value)}
                  className={`${inputBase} ${errors.actualStart ? inputErr : inputOk}`}
                />
                {errors.actualStart && (
                  <p className="mt-1 text-sm text-red-500">{errors.actualStart}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora Término Real
                </label>
                <input
                  type="time"
                  value={meetingTimes.actualEnd ?? ""}
                  onChange={(e) => updateMeetingTimes("actualEnd", e.target.value)}
                  className={`${inputBase} ${errors.actualEnd ? inputErr : inputOk}`}
                />
                {errors.actualEnd && (
                  <p className="mt-1 text-sm text-red-500">{errors.actualEnd}</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <FieldRowRead label="Inicio Real" value={meetingTimes.actualStart} />
              <FieldRowRead label="Término Real" value={meetingTimes.actualEnd} />
            </div>
          )}
        </div>

        {/* Duración calculada */}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
          <FieldRowRead label="Duración (calc.)" value={durationLabel} />
        </div>
      </div>
    </article>
  );
};

export default MinuteEditorCardTimes;