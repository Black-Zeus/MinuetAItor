/**
 * pages/minuteEditor/sections/MinuteEditorSectionMetadata.jsx
 * Tab "Metadata": solo lectura, datos de auditoría.
 *
 * - SHA-256 completo.
 * - Botón "Vista Previa" (modal con contenido + descarga) en TODOS los archivos.
 * - Botón "Descargar" directo en la lista (sin abrir modal).
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MetaRow = ({ label, value, mono = false }) => (
  <div className="col-span-12 md:col-span-6">
    <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme mb-1">{label}</p>
    <p className={`text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme break-all ${mono ? 'font-mono' : ''}`}>
      {value || <span className="italic text-gray-400 dark:text-gray-600">—</span>}
    </p>
  </div>
);

// ── Contenido mockup por tipo ─────────────────────────────────────────────────

const getMockContent = (att) => {
  switch (att.fileType) {
    case 'transcription':
      return (
        `[TRANSCRIPCIÓN — ${att.fileName}]\n\n` +
        `00:00:00 Juan Pérez: Buenos días a todos. Iniciamos la reunión.\n` +
        `00:00:45 María González: Confirmamos la asistencia. El tema principal es la revisión del Q1.\n` +
        `00:01:30 Carlos Rojas: El primer punto es el estado del servidor de producción.\n` +
        `00:02:15 Juan Pérez: Tuvimos un 99.8% de uptime el mes pasado.\n` +
        `00:03:00 María González: ¿Hay incidentes pendientes?\n` +
        `00:03:40 Carlos Rojas: Sí, dos tickets abiertos relacionados con el firewall VLAN.\n` +
        `00:04:20 Juan Pérez: Los asignaremos como acuerdos. Continuamos.\n\n` +
        `[FIN DE TRANSCRIPCIÓN]\n\nSHA-256: ${att.sha256 ?? '—'}`
      );
    case 'summary':
      return (
        `[RESUMEN EJECUTIVO — ${att.fileName}]\n\n` +
        `Reunión de seguimiento de servicios Q1 2026.\n\n` +
        `PUNTOS PRINCIPALES:\n` +
        `• Revisión de uptime del servidor de producción: 99.8%.\n` +
        `• Identificación de 2 tickets abiertos en firewall VLAN.\n` +
        `• Revisión de entregables del proyecto Desarrollo Web Corporativo.\n\n` +
        `ACUERDOS:\n` +
        `• Resolución de tickets de firewall (resp: Carlos Rojas, plazo: 2 semanas).\n` +
        `• Envío de informe mensual a dirección (resp: María González).\n\n` +
        `SHA-256: ${att.sha256 ?? '—'}`
      );
    default:
      return (
        `[ARCHIVO — ${att.fileName}]\n` +
        `Tipo MIME: ${att.mimeType ?? '—'}\n` +
        `SHA-256: ${att.sha256 ?? '—'}\n\n` +
        `[Contenido binario — previsualización no disponible en modo texto.\n` +
        ` Usa el botón Descargar para obtener el archivo original.]`
      );
  }
};

const triggerDownload = (att) => {
  const content = getMockContent(att);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = att.fileName;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Modal de vista previa de archivo ─────────────────────────────────────────

const AttachmentModalContent = ({ att }) => {
  const mockContent = getMockContent(att);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Info + botón descargar */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 transition-theme">
        <Icon name="fileLines" className="text-primary-500 dark:text-primary-400 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate transition-theme">{att.fileName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">{att.mimeType ?? '—'}</p>
          {att.sha256 && (
            <p className="text-xs font-mono text-gray-400 dark:text-gray-500 break-all transition-theme mt-1">
              SHA-256: {att.sha256}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => triggerDownload(att)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-all shadow-sm shrink-0"
        >
          <Icon name="download" />
          Descargar
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/30 transition-theme">
        <pre className="p-4 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed transition-theme">
          {mockContent}
        </pre>
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────

const MinuteEditorSectionMetadata = () => {
  const { metadataLocked } = useMinuteEditorStore();
  const attachments = metadataLocked?.attachments ?? [];

  const openAttachmentModal = (att) => {
    const typeLabel = { transcription: 'Transcripción', summary: 'Resumen', attachment: 'Adjunto', reference: 'Referencia' }[att.fileType] ?? 'Archivo';
    ModalManager.custom({
      title:      `${typeLabel}: ${att.fileName}`,
      size:       'large',
      showFooter: false,
      content:    <AttachmentModalContent att={att} />,
    });
  };

  const fileTypeLabel = (type) => ({ transcription: 'Transcripción', summary: 'Resumen', attachment: 'Adjunto', reference: 'Referencia' }[type] ?? type ?? 'Archivo');

  const badgePalette = {
    transcription: 'bg-blue-50  dark:bg-blue-900/20  text-blue-700  dark:text-blue-300  border-blue-200/50  dark:border-blue-700/50',
    summary:       'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/50 dark:border-green-700/50',
    reference:     'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200/50 dark:border-amber-700/50',
    attachment:    'bg-gray-100 dark:bg-gray-900     text-gray-700  dark:text-gray-300  border-gray-200/50  dark:border-gray-700/50',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
            <Icon name="gear" className="text-primary-600 dark:text-primary-400" />
            Metadata
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
            No modificable. Datos de auditoría y trazabilidad.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50 transition-theme">
          <Icon name="lock" className="mr-1" />
          Bloqueado
        </span>
      </div>

      {/* Datos principales */}
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 p-5 transition-theme">
        <div className="grid grid-cols-12 gap-y-5 gap-x-6">
          <MetaRow label="ID de Transacción"  value={metadataLocked?.transactionId} mono />
          <MetaRow label="Generado"           value={metadataLocked?.generatedAt}   mono />
          <MetaRow label="Preparado por"      value={metadataLocked?.generatedBy} />
          <MetaRow label="Versión"            value={metadataLocked?.version}        mono />
          <MetaRow label="Perfil IA (ID)"     value={metadataLocked?.profileId}      mono />
          <MetaRow label="Perfil IA (Nombre)" value={metadataLocked?.profileName} />
        </div>
      </div>

      {/* Archivos de entrada */}
      {attachments.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase transition-theme mb-3">
            Archivos de entrada
          </p>
          <div className="space-y-3">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 px-4 py-3 transition-theme"
              >
                <Icon name="fileLines" className="text-primary-500 dark:text-primary-400 mt-0.5 shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme">{att.fileName}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border transition-theme ${badgePalette[att.fileType] ?? badgePalette.attachment}`}>
                      {fileTypeLabel(att.fileType)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme mt-0.5">{att.mimeType}</p>
                  <p className="text-xs font-mono text-gray-400 dark:text-gray-500 transition-theme mt-1 break-all">
                    SHA-256: {att.sha256 ?? '—'}
                  </p>
                </div>

                {/* Botones: Vista Previa + Descargar */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openAttachmentModal(att)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-700/50 text-xs font-semibold transition-theme"
                  >
                    <Icon name="eye" className="text-xs" />
                    Vista Previa
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerDownload(att)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-600/50 text-xs font-semibold transition-theme"
                  >
                    <Icon name="download" className="text-xs" />
                    Descargar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default MinuteEditorSectionMetadata;