/**
 * pages/minuteEditor/sections/MinuteEditorSectionMetadata.jsx
 * Tab "Metadata": solo lectura, datos de auditoría y adjuntos de entrada.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';
import { getMinuteAttachmentBlob } from '@/services/minutesService';

const fileTypeLabel = (type) => ({
  transcription: 'Transcripción',
  transcript: 'Transcripción',
  summary: 'Resumen',
  attachment: 'Adjunto',
  reference: 'Referencia',
}[type] ?? type ?? 'Archivo');

const badgePalette = {
  transcription: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-700/50',
  transcript: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-700/50',
  summary: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/50 dark:border-green-700/50',
  reference: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200/50 dark:border-amber-700/50',
  attachment: 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200/50 dark:border-gray-700/50',
};

const inferAttachmentType = (attachment = {}) => {
  const explicitType = attachment.fileType || attachment.type || '';
  if (explicitType) return String(explicitType).toLowerCase();

  const fileName = String(attachment.fileName || attachment.name || '').toLowerCase();
  const mimeType = String(attachment.mimeType || '').toLowerCase();

  if (fileName.includes('transcrip') || fileName.includes('transcript')) return 'transcription';
  if (fileName.includes('resumen') || fileName.includes('summary')) return 'summary';
  if (mimeType.includes('text/plain')) return 'attachment';

  return 'attachment';
};

const isTextMime = (mime = '') => mime.startsWith('text/') || [
  'application/json',
  'application/xml',
  'application/javascript',
].includes(mime);

const isImageMime = (mime = '') => mime.startsWith('image/');
const isPdfMime = (mime = '') => mime === 'application/pdf';

const ReadonlyField = ({ label, value, mono = false }) => (
  <div className="col-span-12 md:col-span-6">
    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 transition-theme">
      {label}
    </label>
    <input
      type="text"
      readOnly
      value={value || '—'}
      className={`w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 transition-theme ${mono ? 'font-mono' : ''}`}
    />
  </div>
);

const AttachmentReadonlyField = ({ label, value, mono = false, grow = false }) => (
  <div className={grow ? 'col-span-12' : 'col-span-12 lg:col-span-6'}>
    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 transition-theme">
      {label}
    </label>
    <input
      type="text"
      readOnly
      value={value || '—'}
      className={`w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 transition-theme ${mono ? 'font-mono' : ''}`}
    />
  </div>
);

const AttachmentPreviewContent = ({ recordId, attachment }) => {
  const [blobUrl, setBlobUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    let currentUrl = '';

    const loadAttachment = async () => {
      try {
        setLoading(true);
        setError('');
        setTextContent('');
        setBlobUrl('');

        const blob = await getMinuteAttachmentBlob(recordId, attachment.sha256);
        if (!isMounted) return;

        if (isTextMime(attachment.mimeType)) {
          const text = await blob.text();
          if (!isMounted) return;
          setTextContent(text);
        } else {
          currentUrl = URL.createObjectURL(blob);
          setBlobUrl(currentUrl);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err?.response?.data?.detail?.message || 'No se pudo cargar el adjunto.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAttachment();

    return () => {
      isMounted = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [attachment.mimeType, attachment.sha256, recordId]);

  const handleDownload = async () => {
    try {
      const blob = await getMinuteAttachmentBlob(recordId, attachment.sha256);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName || 'adjunto';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      ModalManager.warning({
        title: 'Descarga no disponible',
        message: 'No fue posible descargar el adjunto en este momento.',
      });
    }
  };

  const previewNode = useMemo(() => {
    if (loading) {
      return (
        <div className="flex h-[60vh] items-center justify-center text-sm text-gray-500 dark:text-gray-400 transition-theme">
          Cargando adjunto...
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex h-[60vh] items-center justify-center px-6 text-center text-sm text-red-600 dark:text-red-400 transition-theme">
          {error}
        </div>
      );
    }

    if (isTextMime(attachment.mimeType)) {
      return (
        <textarea
          readOnly
          value={textContent}
          className="h-[60vh] w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 font-mono text-xs leading-relaxed text-gray-800 dark:text-gray-200 transition-theme"
        />
      );
    }

    if (isPdfMime(attachment.mimeType) && blobUrl) {
      return (
        <iframe
          src={blobUrl}
          title={attachment.fileName}
          className="h-[60vh] w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white transition-theme"
        />
      );
    }

    if (isImageMime(attachment.mimeType) && blobUrl) {
      return (
        <div className="flex h-[60vh] items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 transition-theme">
          <img
            src={blobUrl}
            alt={attachment.fileName}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      );
    }

    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/30 px-6 text-center transition-theme">
        <Icon name="fileLines" className="text-2xl text-gray-400 dark:text-gray-500" />
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 transition-theme">
          Vista previa inline no disponible para este formato.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">
          Puedes descargar el archivo desde este modal.
        </p>
      </div>
    );
  }, [attachment.fileName, attachment.mimeType, blobUrl, error, loading, textContent]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200/60 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 transition-theme">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme">
              {attachment.fileName}
            </p>
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-theme ${badgePalette[attachment.normalizedType] ?? badgePalette.attachment}`}>
              {fileTypeLabel(attachment.normalizedType)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 transition-theme">
            {attachment.mimeType || 'application/octet-stream'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition-theme hover:bg-primary-700"
        >
          <Icon name="download" className="text-xs" />
          Descargar
        </button>
      </div>

      {previewNode}
    </div>
  );
};

const MinuteEditorSectionMetadata = ({ recordId }) => {
  const { metadataLocked } = useMinuteEditorStore();
  const attachments = useMemo(
    () => (metadataLocked?.attachments ?? []).map((attachment) => ({
      ...attachment,
      normalizedType: inferAttachmentType(attachment),
    })),
    [metadataLocked?.attachments]
  );
  const sourceAttachments = useMemo(
    () => attachments.filter((attachment) => ['transcription', 'transcript', 'summary'].includes(attachment.normalizedType)),
    [attachments]
  );

  const openAttachmentModal = (attachment) => {
    ModalManager.custom({
      title: attachment.fileName || 'Adjunto',
      size: 'large',
      showFooter: false,
      content: <AttachmentPreviewContent recordId={recordId} attachment={attachment} />,
    });
  };

  return (
    <div className="rounded-xl border border-gray-200/50 bg-white p-6 shadow-md transition-theme dark:border-gray-700/50 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 transition-theme dark:text-white">
            <Icon name="gear" className="text-primary-600 dark:text-primary-400" />
            Metadata
          </h2>
          <p className="text-sm text-gray-600 transition-theme dark:text-gray-300">
            Datos de auditoría y adjuntos originales usados como input.
          </p>
        </div>
        <span className="rounded-lg border border-gray-200/50 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 transition-theme dark:border-gray-700/50 dark:bg-gray-900 dark:text-gray-300">
          <Icon name="lock" className="mr-1" />
          Bloqueado
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-5 transition-theme dark:border-gray-600 dark:bg-gray-900/30">
        <div className="grid grid-cols-12 gap-4">
          <ReadonlyField label="ID de Transacción" value={metadataLocked?.transactionId} mono />
          <ReadonlyField label="Generado" value={metadataLocked?.generatedAt} mono />
          <ReadonlyField label="Preparado por" value={metadataLocked?.generatedBy} />
          <ReadonlyField label="Versión" value={metadataLocked?.version} mono />
          <ReadonlyField label="Perfil IA (ID)" value={metadataLocked?.profileId} mono />
          <ReadonlyField label="Perfil IA (Nombre)" value={metadataLocked?.profileName} />
        </div>
      </div>

      {sourceAttachments.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-200/70 bg-white/70 p-5 transition-theme dark:border-gray-700/60 dark:bg-gray-900/20">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="paperclip" className="text-primary-600 dark:text-primary-400" />
            <div>
              <p className="text-sm font-semibold text-gray-900 transition-theme dark:text-gray-100">
                Adjuntos principales de entrada
              </p>
              <p className="text-xs text-gray-500 transition-theme dark:text-gray-400">
                Transcripción y resumen recibidos como input del procesamiento.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            {sourceAttachments.map((attachment, index) => (
              <div
                key={`${attachment.sha256 || attachment.fileName || 'source-attachment'}-${index}`}
                className="col-span-12 rounded-xl border border-gray-200/70 bg-gray-50/70 p-4 transition-theme dark:border-gray-700/60 dark:bg-gray-800/40"
              >
                <div className="grid grid-cols-12 gap-3">
                  <AttachmentReadonlyField label="Nombre" value={attachment.fileName} />
                  <AttachmentReadonlyField label="Tipo" value={fileTypeLabel(attachment.normalizedType)} />
                  <AttachmentReadonlyField label="SHA-256" value={attachment.sha256} mono grow />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500 transition-theme dark:text-gray-400">
            Adjuntos de input
          </p>
          <div className="space-y-4">
            {attachments.map((attachment, index) => (
              <div
                key={`${attachment.sha256 || attachment.fileName || 'attachment'}-${index}`}
                className="rounded-xl border border-gray-200/70 bg-gray-50/60 p-4 transition-theme dark:border-gray-700/60 dark:bg-gray-900/30"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon name="fileLines" className="text-primary-600 dark:text-primary-400" />
                    <span className="text-sm font-semibold text-gray-900 transition-theme dark:text-gray-100">
                      {attachment.fileName || 'Adjunto'}
                    </span>
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-theme ${badgePalette[attachment.normalizedType] ?? badgePalette.attachment}`}>
                      {fileTypeLabel(attachment.normalizedType)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openAttachmentModal(attachment)}
                    className="flex items-center gap-1.5 rounded-lg border border-primary-200/50 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 transition-theme hover:bg-primary-100 dark:border-primary-700/50 dark:bg-primary-900/20 dark:text-primary-300 dark:hover:bg-primary-900/30"
                  >
                    <Icon name="eye" className="text-xs" />
                    Vista previa
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-3">
                  <AttachmentReadonlyField label="Nombre" value={attachment.fileName} />
                  <AttachmentReadonlyField label="Tipo MIME" value={attachment.mimeType} />
                  <AttachmentReadonlyField label="Origen" value={fileTypeLabel(attachment.normalizedType)} />
                  <AttachmentReadonlyField label="SHA-256" value={attachment.sha256} mono grow />
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
