/**
 * components/ui/pdf/PdfViewerModal.jsx
 *
 * Visor de PDF en modal: obtiene el PDF desde el backend (proxy MinIO)
 * y lo muestra en un iframe. Incluye botón de descarga.
 *
 * Uso:
 *   import { openPdfViewer } from '@/components/ui/pdf/PdfViewerModal';
 *
 *   openPdfViewer({
 *     recordId: 'uuid',
 *     pdfType:  'draft',      // 'draft' | 'published'
 *     filename: 'minuta.pdf', // nombre para descarga
 *     title:    'PDF — Reunión de proyecto', // título del modal (opcional)
 *   });
 */

import React, { useEffect, useState, useRef } from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import { getMinutePdfBlob } from '@/services/minutesService';

// ─────────────────────────────────────────────────────────────
// Contenido interno del modal
// ─────────────────────────────────────────────────────────────

const PdfViewerContent = ({ recordId, pdfType, filename }) => {
  const [objectUrl, setObjectUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const urlRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const fetchPdf = async () => {
      try {
        const blob = await getMinutePdfBlob(recordId, pdfType);
        if (!isMounted) return;
        const url   = URL.createObjectURL(blob);
        urlRef.current = url;
        setObjectUrl(url);
      } catch (err) {
        if (!isMounted) return;
        const is404 = err?.response?.status === 404;
        setError(
          is404
            ? 'El PDF aún no ha sido generado. Guarda la minuta para generarlo.'
            : 'No se pudo cargar el PDF. Intenta nuevamente.'
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchPdf();

    return () => {
      isMounted = false;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [recordId, pdfType]);

  const handleDownload = () => {
    if (!objectUrl) return;
    const a  = document.createElement('a');
    a.href   = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 rounded-full border-[3px] border-primary-500 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400 transition-theme">Cargando PDF...</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 px-6">
        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-theme">
          <Icon name="fileLines" className="text-xl text-gray-300 dark:text-gray-600" />
        </div>
        <p className="text-sm text-center text-gray-600 dark:text-gray-400 transition-theme leading-relaxed max-w-xs">
          {error}
        </p>
      </div>
    );
  }

  // ── PDF cargado ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3" style={{ height: '75vh' }}>

      {/* Barra superior */}
      <div className="flex items-center justify-between gap-3 px-1 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="fileLines" className="text-primary-500 shrink-0" />
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
            {filename}
          </span>
          {pdfType === 'draft' && (
            <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-700/40 transition-theme">
              BORRADOR
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-all shadow-sm shrink-0"
        >
          <Icon name="download" className="text-xs" />
          Descargar
        </button>
      </div>

      {/* iframe PDF */}
      <div className="flex-1 rounded-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50 bg-gray-100 dark:bg-gray-900 transition-theme">
        <iframe
          src={objectUrl}
          title="Vista previa PDF"
          className="w-full h-full"
          style={{ border: 'none', minHeight: '500px' }}
        />
      </div>

    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Helper para abrir el modal desde cualquier lugar
// ─────────────────────────────────────────────────────────────

/**
 * Abre el modal de visualización de PDF.
 *
 * @param {Object}              options
 * @param {string}              options.recordId  - ID de la minuta
 * @param {'draft'|'published'} options.pdfType   - Tipo de PDF
 * @param {string}              options.filename  - Nombre sugerido para descarga
 * @param {string}              [options.title]   - Título del modal (opcional)
 */
export const openPdfViewer = ({ recordId, pdfType = 'draft', filename, title }) => {
  ModalManager.custom({
    title:      title ?? `PDF — ${filename}`,
    size:       'pdfViewer',
    showFooter: false,
    content: (
      <PdfViewerContent
        recordId={recordId}
        pdfType={pdfType}
        filename={filename}
      />
    ),
  });
};

export default PdfViewerContent;
