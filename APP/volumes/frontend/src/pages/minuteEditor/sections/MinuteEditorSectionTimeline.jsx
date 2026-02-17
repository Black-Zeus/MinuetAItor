/**
 * pages/minuteEditor/sections/MinuteEditorSectionTimeline.jsx
 * Tab "Línea de Tiempo": historial de versiones publicadas de la minuta.
 *
 * Cada entrada representa un "Publicar PDF". Muestra versión, fecha,
 * autor, observación del publicador y resumen de cambios.
 *
 * Datos: estáticos demo (en producción vendrán del backend).
 * No permite edición de entradas pasadas (solo lectura + trazabilidad).
 */

import React, { useState } from 'react';
import Icon from '@components/ui/icon/iconManager';
import useMinuteEditorStore from '@/store/minuteEditorStore';

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (isoStr) => {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return isoStr; }
};

// Badge de versión con colores escalonados
const VersionBadge = ({ version, isLatest }) => (
  <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold font-mono border transition-theme
    ${isLatest
      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-300/50 dark:border-primary-600/40'
      : 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200/50 dark:border-gray-700/50'
    }`}
  >
    {isLatest && <Icon name="star" className="mr-1 text-[10px]" />}
    {version}
  </span>
);

// ── Tarjeta de entrada del timeline ──────────────────────────────────────────

const TimelineEntry = ({ entry, isLatest, isLast }) => {
  const [expanded, setExpanded] = useState(isLatest);

  return (
    <div className="flex gap-4">
      {/* Conector vertical */}
      <div className="flex flex-col items-center">
        <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 transition-theme
          ${isLatest
            ? 'bg-primary-500 border-primary-500'
            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
          }`}
        />
        {!isLast && <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-1 transition-theme" />}
      </div>

      {/* Contenido */}
      <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
        <div
          className={`rounded-xl border transition-theme overflow-hidden
            ${isLatest
              ? 'border-primary-200/60 dark:border-primary-700/40 shadow-sm'
              : 'border-gray-200/50 dark:border-gray-700/50'
            }`}
        >
          {/* Header de la tarjeta */}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-theme
              ${isLatest
                ? 'bg-primary-50/40 dark:bg-primary-900/10 hover:bg-primary-50/70 dark:hover:bg-primary-900/20'
                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <VersionBadge version={entry.version} isLatest={isLatest} />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme">
                {entry.observation || 'Sin observación registrada'}
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 transition-theme whitespace-nowrap">
                {formatDate(entry.publishedAt)}
              </span>
              <Icon
                name={expanded ? 'chevronUp' : 'chevronDown'}
                className="text-gray-400 dark:text-gray-500 transition-theme text-xs"
              />
            </div>
          </button>

          {/* Detalle expandible */}
          {expanded && (
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800 space-y-3 transition-theme">

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="user" className="text-xs text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">Publicado por</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme">{entry.publishedBy || '—'}</p>
                </div>
              </div>

              {entry.changesSummary && (
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="fileLines" className="text-xs text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">Resumen de cambios</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 transition-theme leading-relaxed">{entry.changesSummary}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <Icon name="clock" className="text-xs text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">Timestamp</p>
                  <p className="text-xs font-mono text-gray-700 dark:text-gray-300 transition-theme">{entry.publishedAt || '—'}</p>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────

const MinuteEditorSectionTimeline = () => {
  const { timeline } = useMinuteEditorStore();

  // Orden cronológico inverso: la versión más reciente primero
  const sorted = [...timeline].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  return (
    <div className="space-y-6">

      {/* Header informativo */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
              <Icon name="history" className="text-primary-600 dark:text-primary-400" />
              Línea de Tiempo
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
              Historial de versiones publicadas. Solo lectura — propósito de trazabilidad y auditoría.
            </p>
          </div>

          {/* Stats rápidos */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-primary-600 dark:text-primary-400 transition-theme">{timeline.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">versión{timeline.length !== 1 ? 'es' : ''}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100 transition-theme">
                {sorted[0]?.version ?? '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">actual</p>
            </div>
          </div>
        </div>

        {/* Aviso demo */}
        <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-700/40 transition-theme">
          <Icon name="triangleExclamation" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 transition-theme">
            <span className="font-semibold">Modo demo:</span> los registros mostrados son estáticos. En producción cada "Publicar PDF" generará una entrada nueva en la base de datos y este historial se cargará desde el backend.
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
        {timeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4 transition-theme">
              <Icon name="history" className="text-gray-400 dark:text-gray-500 text-xl" />
            </div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 transition-theme">Sin historial aún</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 transition-theme mt-1">
              Las entradas aparecerán aquí cada vez que se publique el PDF.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {sorted.map((entry, idx) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                isLatest={idx === 0}
                isLast={idx === sorted.length - 1}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default MinuteEditorSectionTimeline;