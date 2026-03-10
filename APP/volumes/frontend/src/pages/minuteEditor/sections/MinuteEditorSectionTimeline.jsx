/**
 * pages/minuteEditor/sections/MinuteEditorSectionTimeline.jsx
 *
 * Historial de versiones de la minuta — datos reales desde el backend.
 *
 * FLUJO:
 *  - Carga versiones al montar con getMinuteVersions(recordId)
 *  - Se refresca cada vez que cambia `recordStatus` (prop del padre)
 *    El padre (MinuteEditor) pasa el status actualizado tras cada transición.
 *  - Botón "Actualizar" manual disponible en el header del panel
 *
 * PROPS:
 *   recordId     string   — ID de la minuta
 *   recordStatus string   — Estado actual; cuando cambia se dispara recarga
 */

import React, { useState, useEffect, useCallback } from "react";
import Icon from "@components/ui/icon/iconManager";
import ModalManager from "@components/ui/modal";
import { getMinuteVersions } from "@/services/minutesService";

import logger from "@/utils/logger";
const log = logger.scope("minute-editor-timeline");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

// ─────────────────────────────────────────────────────────────────────────────
// BADGE DE VERSIÓN
// ─────────────────────────────────────────────────────────────────────────────

const VersionBadge = ({ label, isLatest }) => (
  <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold font-mono border transition-theme
    ${isLatest
      ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-300/50 dark:border-primary-600/40"
      : "bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200/50 dark:border-gray-700/50"
    }`}
  >
    {isLatest && <Icon name="star" className="mr-1 text-[10px]" />}
    {label}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// BADGE DE ESTADO DE VERSIÓN
// ─────────────────────────────────────────────────────────────────────────────

const StatusVersionBadge = ({ statusCode, statusLabel }) => {
  const styles = {
    final:    "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/50 dark:border-green-700/40",
    snapshot: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200/50 dark:border-indigo-700/40",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border transition-theme
      ${styles[statusCode] ?? styles.snapshot}`}
    >
      {statusLabel}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: VISTA PREVIA PDF (pendiente de worker PDF)
// ─────────────────────────────────────────────────────────────────────────────

const PdfVersionModalContent = ({ version }) => (
  <div className="flex flex-col gap-3 h-full">
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-700/40 transition-theme">
      <Icon name="triangleExclamation" className="text-amber-500 shrink-0 text-xs" />
      <p className="text-xs text-amber-800 dark:text-amber-300 transition-theme">
        El PDF de <strong>{version.versionLabel}</strong> se servirá desde MinIO cuando el worker PDF esté activo.
      </p>
    </div>
    <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 rounded-xl p-4 transition-theme flex items-center justify-center">
      <div
        className="bg-white shadow-xl rounded flex flex-col items-center justify-center gap-4"
        style={{ width: "420px", minHeight: "560px", fontFamily: "sans-serif", padding: "48px 40px" }}
      >
        <div style={{ width: "72px", height: "72px", background: "#eff6ff", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "32px" }}>📄</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "22px", fontWeight: "bold", color: "#1d4ed8", margin: 0 }}>{version.versionLabel}</p>
          <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>{version.statusLabel}</p>
        </div>
        <div style={{ width: "100%", background: "#f9fafb", borderRadius: "12px", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "#374151" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#9ca3af" }}>Publicado por</span>
            <span style={{ fontWeight: "600" }}>{version.publishedBy || "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#9ca3af" }}>Fecha</span>
            <span style={{ fontWeight: "600" }}>{fmtDate(version.publishedAt)}</span>
          </div>
          {version.commitMessage && (
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "8px", marginTop: "4px" }}>
              <p style={{ color: "#9ca3af", marginBottom: "4px" }}>Observación</p>
              <p style={{ color: "#374151", lineHeight: 1.5 }}>{version.commitMessage}</p>
            </div>
          )}
        </div>
        <p style={{ fontSize: "10px", color: "#d1d5db", textAlign: "center", marginTop: "8px" }}>
          PDF pendiente de generación por worker PDF
        </p>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// TARJETA DE VERSIÓN
// ─────────────────────────────────────────────────────────────────────────────

const TimelineEntry = ({ version, isLatest, isLast }) => {
  const [expanded, setExpanded] = useState(isLatest);

  const handleVisualize = () => {
    ModalManager.custom({
      title:      `Vista previa PDF — ${version.versionLabel}`,
      size:       "large",
      showFooter: false,
      content:    <PdfVersionModalContent version={version} />,
    });
  };

  return (
    <div className="flex gap-4">
      {/* Conector vertical */}
      <div className="flex flex-col items-center">
        <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 transition-theme
          ${isLatest
            ? "bg-primary-500 border-primary-500"
            : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
          }`}
        />
        {!isLast && <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-1 transition-theme" />}
      </div>

      {/* Tarjeta */}
      <div className="flex-1 pb-6">
        <div className={`rounded-xl border transition-theme overflow-hidden
          ${isLatest
            ? "border-primary-200/60 dark:border-primary-700/40 shadow-sm"
            : "border-gray-200/50 dark:border-gray-700/50"
          }`}
        >
          {/* Header colapsable */}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-theme
              ${isLatest
                ? "bg-primary-50/40 dark:bg-primary-900/10 hover:bg-primary-50/60 dark:hover:bg-primary-900/15"
                : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-wrap">
              <VersionBadge label={version.versionLabel} isLatest={isLatest} />
              <StatusVersionBadge statusCode={version.statusCode} statusLabel={version.statusLabel} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate transition-theme">
                  {version.commitMessage || (isLatest ? "Versión actual" : "Publicación")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">
                  {version.publishedBy || "—"} · {fmtDate(version.publishedAt)}
                </p>
              </div>
            </div>
            <Icon
              name={expanded ? "chevronUp" : "chevronDown"}
              className="text-gray-400 dark:text-gray-500 shrink-0 transition-theme"
            />
          </button>

          {/* Detalle expandido */}
          {expanded && (
            <div className={`px-5 py-4 space-y-4 border-t transition-theme
              ${isLatest
                ? "bg-primary-50/20 dark:bg-primary-900/5 border-primary-100 dark:border-primary-800/30"
                : "bg-gray-50/50 dark:bg-gray-900/20 border-gray-100 dark:border-gray-700/50"
              }`}
            >
              {/* Observación / commit message */}
              {version.commitMessage && (
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="comment" className="text-xs text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">Observación</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 transition-theme leading-relaxed">
                      {version.commitMessage}
                    </p>
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
                      {version.publishedAt ? new Date(version.publishedAt).toISOString() : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                    <Icon name="user" className="text-xs text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">Publicado por</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 transition-theme">
                      {version.publishedBy || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Acciones PDF */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50 transition-theme flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 transition-theme">
                  PDF {version.versionLabel}:
                </span>
                <button
                  type="button"
                  onClick={handleVisualize}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20
                    hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-700 dark:text-primary-300
                    border border-primary-200/50 dark:border-primary-700/50 text-xs font-semibold transition-theme"
                >
                  <Icon name="eye" className="text-xs" />
                  Visualizar
                </button>
                {/* Descargar: disponible cuando el worker PDF esté activo */}
                <button
                  type="button"
                  disabled
                  title="Disponible cuando el worker PDF genere el archivo"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700
                    text-gray-400 dark:text-gray-500 border border-gray-200/50 dark:border-gray-600/50
                    text-xs font-semibold cursor-not-allowed opacity-50 transition-theme"
                >
                  <Icon name="download" className="text-xs" />
                  Descargar
                  <Icon name="lock" className="text-[9px] opacity-60" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

const MinuteEditorSectionTimeline = ({ recordId, recordStatus }) => {
  const [versions, setVersions] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const fetchVersions = useCallback(async () => {
    if (!recordId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMinuteVersions(recordId);
      setVersions(data?.versions ?? []);
    } catch (err) {
      log.error("Error cargando versiones:", err);
      setError(err?.message ?? "No se pudieron cargar las versiones.");
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  // Carga inicial
  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  // Refresco automático al cambiar de estado
  useEffect(() => {
    if (recordStatus) fetchVersions();
  }, [recordStatus]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header del panel */}
      <div className="rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
              <Icon name="history" className="text-primary-600 dark:text-primary-400" />
              Línea de tiempo
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
              Historial de versiones publicadas. Solo lectura — trazabilidad y auditoría.
            </p>
          </div>

          <div className="flex items-center gap-5 shrink-0">
            {/* Contador versiones */}
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-primary-600 dark:text-primary-400 transition-theme">
                {loading ? "—" : versions.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">
                versión{versions.length !== 1 ? "es" : ""}
              </p>
            </div>

            {/* Versión actual */}
            {versions[0] && (
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100 transition-theme">
                  {versions[0].versionLabel}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">actual</p>
              </div>
            )}

            {/* Botón actualizar */}
            <button
              type="button"
              onClick={fetchVersions}
              disabled={loading}
              title="Actualizar línea de tiempo"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition-theme
                bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700
                text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name={loading ? "spinner" : "arrowsRotate"} className={`text-xs ${loading ? "animate-spin" : ""}`} />
              {loading ? "Cargando…" : "Actualizar"}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de versiones */}
      <div className="rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-700/40 transition-theme mb-4">
            <Icon name="triangleExclamation" className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 transition-theme">
                Error al cargar el historial
              </p>
              <p className="text-xs text-red-700 dark:text-red-400 transition-theme mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && versions.length === 0 && (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 mt-1 shrink-0" />
                <div className="flex-1 h-16 rounded-xl bg-gray-100 dark:bg-gray-700/50" />
              </div>
            ))}
          </div>
        )}

        {/* Sin versiones */}
        {!loading && versions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4 transition-theme">
              <Icon name="history" className="text-gray-400 dark:text-gray-500 text-xl" />
            </div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 transition-theme">
              Sin historial aún
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-600 transition-theme mt-1">
              Las versiones aparecerán aquí cuando se envíe la minuta a revisión.
            </p>
          </div>
        )}

        {/* Versiones */}
        {versions.length > 0 && (
          <div className="space-y-0">
            {versions.map((v, idx) => (
              <TimelineEntry
                key={v.versionId}
                version={v}
                isLatest={idx === 0}
                isLast={idx === versions.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MinuteEditorSectionTimeline;