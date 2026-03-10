/**
 * pages/minuteEditor/sections/MinuteEditorSectionTimeline.jsx
 * Historial de versiones. Cada entrada expandida muestra botones
 * "Visualizar" (modal) y "Descargar" PDF de esa versión.
 */

import React, { useState } from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

// ── Badge versión ─────────────────────────────────────────────────────────────

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

// ── Modal de visualización de PDF por versión (mockup) ────────────────────────

const PdfVersionModalContent = ({ entry }) => (
  <div className="flex flex-col gap-3 h-full">
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-700/40 transition-theme">
      <Icon name="triangleExclamation" className="text-amber-500 shrink-0 text-xs" />
      <p className="text-xs text-amber-800 dark:text-amber-300 transition-theme">
        Mockup. El PDF real de <strong>{entry.version}</strong> se servirá desde MinIO cuando el worker PDF esté activo.
      </p>
    </div>

    <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 rounded-xl p-4 transition-theme flex items-center justify-center">
      <div
        className="bg-white shadow-xl rounded flex flex-col items-center justify-center gap-4"
        style={{ width: '420px', minHeight: '560px', fontFamily: 'sans-serif', padding: '48px 40px' }}
      >
        {/* Ícono documento */}
        <div style={{ width: '72px', height: '72px', background: '#eff6ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '32px' }}>📄</span>
        </div>

        {/* Versión */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#1d4ed8', margin: 0 }}>{entry.version}</p>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Minuta de Reunión</p>
        </div>

        {/* Datos */}
        <div style={{ width: '100%', background: '#f9fafb', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#374151' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9ca3af' }}>Publicado por</span>
            <span style={{ fontWeight: '600' }}>{entry.publishedBy || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9ca3af' }}>Fecha</span>
            <span style={{ fontWeight: '600' }}>{fmtDate(entry.publishedAt)}</span>
          </div>
          {entry.observation && (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '4px' }}>
              <p style={{ color: '#9ca3af', marginBottom: '4px' }}>Observación</p>
              <p style={{ color: '#374151', lineHeight: 1.5 }}>{entry.observation}</p>
            </div>
          )}
        </div>

        <p style={{ fontSize: '10px', color: '#d1d5db', textAlign: 'center', marginTop: '8px' }}>
          PDF pendiente de generación por worker PDF
        </p>
      </div>
    </div>
  </div>
);

// ── Tarjeta de versión ────────────────────────────────────────────────────────

const TimelineEntry = ({ entry, isLatest, isLast }) => {
  const [expanded, setExpanded] = useState(isLatest);

  const handleVisualize = () => {
    ModalManager.custom({
      title:      `Vista Previa PDF — ${entry.version}`,
      size:       'large',
      showFooter: false,
      content:    <PdfVersionModalContent entry={entry} />,
    });
  };

  const handleDownload = () => {
    const text = [
      `Minuta ${entry.version}`,
      `Publicado por: ${entry.publishedBy || '—'}`,
      `Fecha: ${entry.publishedAt || '—'}`,
      `Observación: ${entry.observation || '—'}`,
      `Resumen de cambios: ${entry.changesSummary || '—'}`,
      '',
      '[PDF pendiente de generación por worker PDF]',
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `minuta_${entry.version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

      {/* Tarjeta */}
      <div className="flex-1 pb-6">
        <div className={`rounded-xl border transition-theme overflow-hidden
          ${isLatest
            ? 'border-primary-200/60 dark:border-primary-700/40 shadow-sm'
            : 'border-gray-200/50 dark:border-gray-700/50'
          }`}
        >
          {/* Header colapsable */}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-theme
              ${isLatest
                ? 'bg-primary-50/40 dark:bg-primary-900/10 hover:bg-primary-50/60 dark:hover:bg-primary-900/15'
                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <VersionBadge version={entry.version} isLatest={isLatest} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate transition-theme">
                  {entry.observation || entry.changesSummary || 'Publicación'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">
                  {entry.publishedBy || '—'} · {fmtDate(entry.publishedAt)}
                </p>
              </div>
            </div>
            <Icon
              name={expanded ? 'chevronUp' : 'chevronDown'}
              className="text-gray-400 dark:text-gray-500 shrink-0 transition-theme"
            />
          </button>

          {/* Detalle */}
          {expanded && (
            <div className={`px-5 py-4 space-y-4 border-t transition-theme
              ${isLatest
                ? 'bg-primary-50/20 dark:bg-primary-900/5 border-primary-100 dark:border-primary-800/30'
                : 'bg-gray-50/50 dark:bg-gray-900/20 border-gray-100 dark:border-gray-700/50'
              }`}
            >
              {/* Observación */}
              {entry.observation && (
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="comment" className="text-xs text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">Observación</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 transition-theme leading-relaxed">{entry.observation}</p>
                  </div>
                </div>
              )}

              {/* Resumen de cambios */}
              {entry.changesSummary && entry.changesSummary !== entry.observation && (
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

              {/* Timestamp + Autor */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                    <Icon name="clock" className="text-xs text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">Timestamp</p>
                    <p className="text-xs font-mono text-gray-700 dark:text-gray-300 transition-theme">
                      {entry.publishedAt ? new Date(entry.publishedAt).toISOString() : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                    <Icon name="user" className="text-xs text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">Publicado por</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 transition-theme">{entry.publishedBy || '—'}</p>
                  </div>
                </div>
              </div>

              {/* ── Acciones PDF ── */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50 transition-theme flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 transition-theme">
                  PDF {entry.version}:
                </span>
                <button
                  type="button"
                  onClick={handleVisualize}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-700/50 text-xs font-semibold transition-theme"
                >
                  <Icon name="eye" className="text-xs" />
                  Visualizar
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-600/50 text-xs font-semibold transition-theme"
                >
                  <Icon name="download" className="text-xs" />
                  Descargar
                </button>
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
  const sorted = [...timeline].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
              <Icon name="history" className="text-primary-600 dark:text-primary-400" />
              Línea de Tiempo
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
              Historial de versiones publicadas. Solo lectura — trazabilidad y auditoría.
            </p>
          </div>
          <div className="flex items-center gap-6 shrink-0">
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
            {sorted[sorted.length - 1]?.publishedAt && (
              <div className="text-center hidden sm:block">
                <p className="text-xs font-mono text-gray-500 dark:text-gray-400 transition-theme">
                  {new Date(sorted[sorted.length - 1].publishedAt).toLocaleDateString('es-CL')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-600 transition-theme">creación</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Entradas */}
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