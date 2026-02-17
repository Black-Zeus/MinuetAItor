/**
 * pages/minuteEditor/sections/MinuteEditorSectionMetadata.jsx
 * Tab "Metadata": solo lectura, bloqueado, datos de auditoría.
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import useMinuteEditorStore from '@/store/minuteEditorStore';

const MetaRow = ({ label, value, mono = false }) => (
  <div className="col-span-12 md:col-span-6">
    <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme mb-1">{label}</p>
    <p className={`text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme ${mono ? 'font-mono' : ''}`}>
      {value || <span className="italic text-gray-400 dark:text-gray-600">—</span>}
    </p>
  </div>
);

const MinuteEditorSectionMetadata = () => {
  const { metadataLocked } = useMinuteEditorStore();

  const attachments = metadataLocked?.attachments ?? [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
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

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase transition-theme mb-3">
            Archivos de entrada
          </p>
          <div className="space-y-2">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 px-4 py-3 transition-theme"
              >
                <Icon name="fileLines" className="text-primary-500 dark:text-primary-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme truncate">{att.fileName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">{att.mimeType}</p>
                  <p className="text-xs font-mono text-gray-400 dark:text-gray-600 transition-theme truncate">sha256: {att.sha256?.slice(0, 24)}…</p>
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