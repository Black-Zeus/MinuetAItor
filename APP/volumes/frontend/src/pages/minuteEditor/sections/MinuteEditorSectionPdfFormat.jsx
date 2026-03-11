/**
 * pages/minuteEditor/sections/MinuteEditorSectionPdfFormat.jsx
 * Tab "Formato PDF": selección de template real y configuración de hojas adicionales.
 *
 * Los IDs de template deben coincidir con TEMPLATE_MAP en pdf-worker/handlers/minute_pdf.py.
 * La selección se persiste en pdfFormat.template del store y viaja con el autosave.
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';
import { previewMinutePdfBlob } from '@/services/minutesService';
import { openPdfViewer } from '@/components/ui/pdf/PdfViewerModal';

// ─────────────────────────────────────────────────────────────
// Templates reales del pdf-worker
// IDs = claves en TEMPLATE_MAP de handlers/minute_pdf.py
// ─────────────────────────────────────────────────────────────

const PDF_TEMPLATES = [
  {
    id:          'opc_01',
    name:        'Corporativa Completa',
    description: 'Documento formal multipágina con portada, carátula de ficha técnica, secciones de contenido y página de firmas opcionales. Ideal para reuniones de proyecto con alta formalidad.',
    thumb:       'layout',
  },
  {
    id:          'opc_02',
    name:        'Ejecutiva Moderna',
    description: 'Diseño moderno y compacto con encabezado degradado azul. Grid de participantes en 3 columnas y tarjetas de sección con badges de tipo. Sin portada — directo al contenido.',
    thumb:       'briefcase',
  },
  {
    id:          'opc_04',
    name:        'Gobernanza / Comité',
    description: 'Acta de comité con estructura formal: portada con código COM-YYYYMMDD, resumen de resoluciones numeradas y grilla de firmas para aprobación institucional.',
    thumb:       'building',
  },
];

const buildPreviewFilename = (meetingInfo = {}) => {
  const rawTitle = String(meetingInfo.subject ?? 'minuta').trim() || 'minuta';
  const safeTitle = rawTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'minuta';

  const rawDate = String(meetingInfo.meetingDate ?? '').trim();
  const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const now = new Date();

  return `${match?.[1] ?? String(now.getFullYear())}${match?.[2] ?? String(now.getMonth() + 1).padStart(2, '0')}${match?.[3] ?? String(now.getDate()).padStart(2, '0')}_${safeTitle}_preview.pdf`;
};

// ─────────────────────────────────────────────────────────────
// Selector de template
// ─────────────────────────────────────────────────────────────

const TemplateSelector = ({ recordId, selectedId, onChange, isReadOnly }) => {
  const { meetingInfo, getExportPayload } = useMinuteEditorStore();
  const selected = PDF_TEMPLATES.find(t => t.id === selectedId) ?? PDF_TEMPLATES[0];
  const [isGeneratingPreview, setIsGeneratingPreview] = React.useState(false);

  const openPreview = async () => {
    if (!recordId || isGeneratingPreview) return;

    setIsGeneratingPreview(true);
    try {
      const blob = await previewMinutePdfBlob(recordId, getExportPayload());
      openPdfViewer({
        title: `Vista Previa — ${selected.name}`,
        filename: buildPreviewFilename(meetingInfo),
        blob,
      });
    } catch {
      ModalManager.error?.({
        title: 'Error',
        message: 'No fue posible generar la vista previa del PDF.',
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <div className="space-y-3">

      {/* DDL */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider transition-theme">
          Template de minuta
        </label>
        <select
          value={selectedId}
          onChange={e => !isReadOnly && onChange(e.target.value)}
          disabled={isReadOnly}
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {PDF_TEMPLATES.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Descripción + botón preview */}
      <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30 px-4 py-3 transition-theme">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0 transition-theme">
            <Icon name={selected.thumb} className="text-primary-600 dark:text-primary-400 text-xs" />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed transition-theme">
            {selected.description}
          </p>
        </div>
        <button
          type="button"
          onClick={openPreview}
          disabled={!recordId || isGeneratingPreview}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-all shadow-sm shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name={isGeneratingPreview ? 'spinner' : 'eye'} className={`text-xs ${isGeneratingPreview ? 'animate-spin' : ''}`} />
          {isGeneratingPreview ? 'Generando…' : 'Vista Previa'}
        </button>
      </div>

    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Helper: campo de solo lectura derivado
// ─────────────────────────────────────────────────────────────

const DerivedField = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme mb-1">{label}</p>
    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme">
      {value || <span className="italic text-gray-400 dark:text-gray-600">—</span>}
    </p>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Toggle card para hojas adicionales
// ─────────────────────────────────────────────────────────────

const SheetToggleCard = ({ title, description, icon, enabled, onToggle, children, isReadOnly = false }) => (
  <article className={`rounded-xl border transition-theme overflow-hidden shadow-sm
    ${enabled
      ? 'border-primary-300/60 dark:border-primary-600/40'
      : 'border-gray-200/50 dark:border-gray-700/50'
    }`}
  >
    <div className={`flex items-center justify-between gap-4 px-6 py-4 transition-theme
      ${enabled
        ? 'bg-primary-50/40 dark:bg-primary-900/10'
        : 'bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-theme
          ${enabled
            ? 'bg-primary-600/15 dark:bg-primary-500/20'
            : 'bg-gray-100 dark:bg-gray-700'
          }`}
        >
          <Icon name={icon} className={enabled ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white transition-theme">{title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">{description}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={isReadOnly}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none
          ${enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}
          ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={enabled ? 'Desactivar' : 'Activar'}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
          ${enabled ? 'translate-x-7' : 'translate-x-1'}`}
        />
      </button>
    </div>

    {enabled && (
      <div className="px-6 py-5 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/50 transition-theme">
        {children}
      </div>
    )}
  </article>
);

// ─────────────────────────────────────────────────────────────
// Hojas de configuración individuales
// ─────────────────────────────────────────────────────────────

const CoverPageConfig = () => {
  const { meetingInfo, pdfFormat, updateCoverPage } = useMinuteEditorStore();
  const cfg = pdfFormat.coverPage;

  return (
    <div className="grid grid-cols-12 gap-4">
      {['projectName', 'minuteTitle', 'preparedBy'].map((field) => {
        const labels = { projectName: 'Nombre del Proyecto', minuteTitle: 'Título del Documento', preparedBy: 'Elaborado por' };
        return (
          <div key={field} className="col-span-12 md:col-span-6">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider transition-theme">
              {labels[field]}
            </label>
            <input
              type="text"
              value={cfg[field] ?? ''}
              onChange={e => updateCoverPage(field, e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
        );
      })}

      <div className="col-span-12">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider transition-theme">
          Nota en el pie de página
        </label>
        <input
          type="text"
          value={cfg.footerNote ?? ''}
          onChange={e => updateCoverPage('footerNote', e.target.value)}
          placeholder="Ej: Documento confidencial — uso interno"
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />
      </div>
    </div>
  );
};

const SummarySheetConfig = () => {
  const { meetingInfo, meetingTimes, metadataLocked, timeline } = useMinuteEditorStore();
  const currentVersion = [...timeline].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0]?.version ?? 'v1.0';
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">
        Carátula generada automáticamente con los datos derivados de la minuta.
      </p>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 md:col-span-6"><DerivedField label="Cliente"       value={meetingInfo.client} /></div>
        <div className="col-span-12 md:col-span-6"><DerivedField label="Asunto"        value={meetingInfo.subject} /></div>
        <div className="col-span-12 md:col-span-6"><DerivedField label="Fecha"         value={meetingInfo.meetingDate} /></div>
        <div className="col-span-12 md:col-span-6"><DerivedField label="Versión"       value={currentVersion} /></div>
        <div className="col-span-12 md:col-span-6"><DerivedField label="Elaborado por" value={meetingInfo.preparedBy} /></div>
        <div className="col-span-12 md:col-span-6"><DerivedField label="Perfil IA"     value={metadataLocked?.profileName} /></div>
      </div>
    </div>
  );
};

const VersionControlConfig = () => {
  const { timeline } = useMinuteEditorStore();
  const sorted = [...timeline].sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">
        Generado automáticamente desde la Línea de Tiempo. Cada "Publicar PDF" añade una fila.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200/50 dark:border-gray-700/50 transition-theme">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 transition-theme">
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Versión</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Fecha</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Autor</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider">Descripción</th>
            </tr>
          </thead>
          <tbody className="text-gray-900 dark:text-gray-100 transition-theme">
            {sorted.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-400 dark:text-gray-600 italic">Sin entradas aún.</td></tr>
            ) : sorted.map(e => (
              <tr key={e.id} className="border-t border-gray-100 dark:border-gray-700/50 transition-theme">
                <td className="px-4 py-3 font-mono font-bold text-primary-600 dark:text-primary-400">{e.version}</td>
                <td className="px-4 py-3 font-mono whitespace-nowrap">{e.publishedAt?.slice(0, 10) ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{e.publishedBy}</td>
                <td className="px-4 py-3">{e.observation || e.changesSummary || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SignaturePageConfig = ({ isReadOnly = false }) => {
  const { pdfFormat, addSignatory, updateSignatory, deleteSignatory } = useMinuteEditorStore();
  const signatories = pdfFormat.signaturePage.signatories;

  const openForm = (existing = null) => {
    let draft = existing ? { ...existing } : { fullName: '', role: '', area: '' };

    const handleSave = (modalId) => {
      if (!draft.fullName?.trim()) {
        ModalManager.warning({ title: 'Campo requerido', message: 'El nombre es obligatorio.' });
        return;
      }
      if (existing) updateSignatory(existing.id, draft);
      else          addSignatory(draft);
      ModalManager.close(modalId);
    };

    const modalId = ModalManager.custom({
      title:      existing ? 'Editar firmante' : 'Agregar firmante',
      size:       'small',
      showFooter: true,
      content: (
        <div className="p-5 space-y-4">
          {[['fullName','Nombre completo','Ej: Juan Pérez','text'],['role','Cargo','Ej: Gerente de Proyecto','text'],['area','Área / Empresa','Ej: TI','text']].map(([field, label, ph, type]) => (
            <div key={field}>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider transition-theme">{label}</label>
              <input
                type={type}
                defaultValue={draft[field] ?? ''}
                onChange={e => { draft = { ...draft, [field]: e.target.value }; }}
                placeholder={ph}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          ))}
        </div>
      ),
      buttons: [{ text: 'Guardar', variant: 'primary', onClick: () => handleSave(modalId) }],
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">
          Personas que firmarán/aprobarán el documento. Se generará un cuadro de firma por cada firmante.
        </p>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => openForm()}
            className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-all shadow-sm shrink-0"
          >
            <Icon name="plus" className="mr-1" />
            Agregar
          </button>
        )}
      </div>

      {signatories.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-600 italic transition-theme">Sin firmantes aún.</p>
      ) : (
        <div className="space-y-2">
          {signatories.map(sig => (
            <div key={sig.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900/30 border border-gray-200/50 dark:border-gray-700/50 transition-theme">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate transition-theme">{sig.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">{sig.role}{sig.area ? ` · ${sig.area}` : ''}</p>
              </div>
              <div className="flex gap-1">
                <button type="button" disabled={isReadOnly} onClick={() => openForm(sig)} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-theme disabled:opacity-50 disabled:cursor-not-allowed"><Icon name="pen" className="text-xs" /></button>
                <button type="button" disabled={isReadOnly} onClick={() => deleteSignatory(sig.id)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-500 dark:text-gray-400 hover:text-red-600 transition-theme disabled:opacity-50 disabled:cursor-not-allowed"><Icon name="trash" className="text-xs" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Definición de hojas
// ─────────────────────────────────────────────────────────────

const PDF_SHEETS = [
  { key: 'coverPage',      title: 'Portada',              description: 'Hoja de presentación con título, logos y datos del documento.',          icon: 'fileLines',    ConfigComponent: CoverPageConfig },
  { key: 'summarySheet',   title: 'Carátula / Ficha',     description: 'Tabla resumen de la minuta: cliente, proyecto, versión, fecha, estado.',  icon: 'clipboardList', ConfigComponent: SummarySheetConfig },
  { key: 'versionControl', title: 'Control de Versiones', description: 'Historial de versiones del documento generado desde la Línea de Tiempo.', icon: 'history',       ConfigComponent: VersionControlConfig },
  { key: 'signaturePage',  title: 'Firmas / Aprobación',  description: 'Hoja con cuadros de firma para los participantes clave.',                 icon: 'pen',           ConfigComponent: SignaturePageConfig },
];

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────

const MinuteEditorSectionPdfFormat = ({ recordId, isReadOnly = false }) => {
  const { pdfFormat, togglePdfSheet, setPdfTemplate } = useMinuteEditorStore();
  const selectedTemplate = pdfFormat.template ?? 'opc_01';
  const enabledCount = PDF_SHEETS.filter(s => pdfFormat[s.key]?.enabled).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
              <Icon name="gear" className="text-primary-600 dark:text-primary-400" />
              Formato de salida PDF
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
              Selecciona el template visual y activa las hojas adicionales que se incluirán en el PDF.
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/50 dark:border-gray-700/50 transition-theme">
            <Icon name="fileLines" className="text-primary-500 dark:text-primary-400 text-sm" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme">
              {enabledCount} de {PDF_SHEETS.length} hojas activas
            </span>
          </div>
        </div>

        {/* Selector de template */}
        <div className="mt-5 border-t border-gray-100 dark:border-gray-700/50 pt-5 transition-theme">
          <TemplateSelector recordId={recordId} selectedId={selectedTemplate} onChange={setPdfTemplate} isReadOnly={isReadOnly} />
        </div>
      </div>

      {/* Hojas adicionales */}
      <div className="space-y-4">
        {PDF_SHEETS.map(({ key, title, description, icon, ConfigComponent }) => (
          <SheetToggleCard
            key={key}
            title={title}
            description={description}
            icon={icon}
            enabled={pdfFormat[key]?.enabled ?? false}
            onToggle={() => togglePdfSheet(key)}
            isReadOnly={isReadOnly}
          >
            <ConfigComponent isReadOnly={isReadOnly} />
          </SheetToggleCard>
        ))}
      </div>

    </div>
  );
};

export default MinuteEditorSectionPdfFormat;
