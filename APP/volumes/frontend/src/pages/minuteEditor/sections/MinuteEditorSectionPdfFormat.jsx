/**
 * pages/minuteEditor/sections/MinuteEditorSectionPdfFormat.jsx
 * Tab "Formato PDF": configura las hojas adicionales que se incluirán en el PDF.
 *
 * Las 4 hojas configurables:
 *  - Portada:           hoja visual con logos + título + elaborador (logos = globales del sistema)
 *  - Carátula/Ficha:    tabla resumen de la minuta (auto-derivada de meetingInfo)
 *  - Control versiones: tabla historial derivada de la línea de tiempo
 *  - Firmas:            cuadro de firmas con firmantes editables
 *
 * Cada sección tiene un toggle ON/OFF y, si está activa, muestra su configuración.
 * Los cambios solo afectan el export PDF (no al editor).
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';

// ── Helper: Toggle card ───────────────────────────────────────────────────────

const SheetToggleCard = ({ title, description, icon, enabled, onToggle, children }) => (
  <article className={`rounded-xl border transition-theme overflow-hidden shadow-sm
    ${enabled
      ? 'border-primary-300/60 dark:border-primary-600/40'
      : 'border-gray-200/50 dark:border-gray-700/50'
    }`}
  >
    {/* Header con toggle */}
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

      {/* Toggle switch */}
      <button
        type="button"
        onClick={onToggle}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none
          ${enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        aria-label={enabled ? 'Desactivar' : 'Activar'}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
          ${enabled ? 'translate-x-7' : 'translate-x-1'}`}
        />
      </button>
    </div>

    {/* Configuración (solo visible si está activa) */}
    {enabled && children && (
      <div className="px-6 py-5 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/50 transition-theme">
        {children}
      </div>
    )}
  </article>
);

// ── Etiqueta de campo readonly derivado ──────────────────────────────────────

const DerivedField = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme mb-1">{label}</p>
    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
      {value || <span className="italic text-gray-400 dark:text-gray-600">—</span>}
    </p>
  </div>
);

// ── Portada ───────────────────────────────────────────────────────────────────

const CoverPageConfig = () => {
  const { pdfFormat, meetingInfo, updateCoverPage } = useMinuteEditorStore();
  const cfg = pdfFormat.coverPage;

  return (
    <div className="space-y-4">
      {/* Aviso logos globales */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/15 border border-blue-200/60 dark:border-blue-700/40 transition-theme">
        <Icon name="circleInfo" className="text-blue-500 dark:text-blue-400 mt-0.5 shrink-0 text-sm" />
        <p className="text-xs text-blue-800 dark:text-blue-300 transition-theme">
          Los logos (aplicación y cliente) son globales del sistema. Se insertarán automáticamente en la portada.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Campos editables */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider transition-theme">
            Nombre del proyecto
          </label>
          <input
            type="text"
            value={cfg.projectName}
            onChange={e => updateCoverPage('projectName', e.target.value)}
            placeholder="Ej: Desarrollo Web Corporativo"
            className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>

        <div className="col-span-12 md:col-span-6">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider transition-theme">
            Elaborado por
          </label>
          <input
            type="text"
            value={cfg.preparedBy}
            onChange={e => updateCoverPage('preparedBy', e.target.value)}
            placeholder="Nombre del elaborador"
            className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>

        <div className="col-span-12">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider transition-theme">
            Título de la minuta
          </label>
          <input
            type="text"
            value={cfg.minuteTitle}
            onChange={e => updateCoverPage('minuteTitle', e.target.value)}
            placeholder="Título que aparecerá en la portada"
            className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
          {cfg.minuteTitle !== meetingInfo.subject && meetingInfo.subject && (
            <button
              type="button"
              onClick={() => updateCoverPage('minuteTitle', meetingInfo.subject)}
              className="mt-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline transition-theme"
            >
              <Icon name="rotateLeft" className="mr-1" />
              Restablecer desde asunto de la reunión
            </button>
          )}
        </div>

        <div className="col-span-12">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider transition-theme">
            Nota en el pie de página
          </label>
          <input
            type="text"
            value={cfg.footerNote}
            onChange={e => updateCoverPage('footerNote', e.target.value)}
            placeholder="Ej: Documento confidencial — uso interno"
            className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>
      </div>
    </div>
  );
};

// ── Carátula/Ficha ────────────────────────────────────────────────────────────

const SummarySheetConfig = () => {
  const { meetingInfo, meetingTimes, metadataLocked, timeline } = useMinuteEditorStore();
  const currentVersion = [...timeline].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0]?.version ?? 'v1.0';

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">
        La carátula se genera automáticamente con los siguientes datos derivados de la minuta. No requiere configuración adicional.
      </p>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 md:col-span-6"><DerivedField label="Cliente"    value={meetingInfo.client} /></div>
        <div className="col-span-12 md:col-span-6"><DerivedField label="Asunto"     value={meetingInfo.subject} /></div>
        <div className="col-span-12 md:col-span-6"><DerivedField label="Fecha"      value={meetingInfo.meetingDate} /></div>
        <div className="col-span-12 md:col-span-6"><DerivedField label="Versión"    value={currentVersion} /></div>
        <div className="col-span-12 md:col-span-6"><DerivedField label="Elaborado por" value={meetingInfo.preparedBy} /></div>
        <div className="col-span-12 md:col-span-6"><DerivedField label="Perfil IA"  value={metadataLocked?.profileName} /></div>
      </div>
    </div>
  );
};

// ── Control de versiones ──────────────────────────────────────────────────────

const VersionControlConfig = () => {
  const { timeline } = useMinuteEditorStore();
  const sorted = [...timeline].sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">
        La tabla de control de versiones se genera automáticamente desde la Línea de Tiempo. Cada "Publicar PDF" añade una fila.
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
            ) : sorted.map((entry, idx) => (
              <tr key={entry.id} className="border-t border-gray-100 dark:border-gray-700/50 transition-theme">
                <td className="px-4 py-3 font-mono font-bold text-primary-600 dark:text-primary-400">{entry.version}</td>
                <td className="px-4 py-3 font-mono whitespace-nowrap">{entry.publishedAt?.slice(0, 10) ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{entry.publishedBy}</td>
                <td className="px-4 py-3">{entry.observation || entry.changesSummary || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Firmas ────────────────────────────────────────────────────────────────────

const SignaturePageConfig = () => {
  const { pdfFormat, addSignatory, updateSignatory, deleteSignatory } = useMinuteEditorStore();
  const signatories = pdfFormat.signaturePage.signatories;

  const openForm = (existing = null) => {
    let draft = existing ? { ...existing } : { fullName: '', role: '', area: '' };

    ModalManager.form({
      title: existing ? 'Editar firmante' : 'Agregar firmante',
      size: 'small',
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">Nombre completo *</label>
            <input
              type="text"
              defaultValue={draft.fullName}
              onChange={e => { draft.fullName = e.target.value; }}
              placeholder="Ej: Juan Pérez"
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">Cargo / Rol</label>
            <input
              type="text"
              defaultValue={draft.role}
              onChange={e => { draft.role = e.target.value; }}
              placeholder="Ej: Jefe de Proyectos"
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">Área / Empresa</label>
            <input
              type="text"
              defaultValue={draft.area}
              onChange={e => { draft.area = e.target.value; }}
              placeholder="Ej: TI – Clínica Santa Aurora"
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
        </div>
      ),
      confirmText: 'Guardar',
      onConfirm: () => {
        if (!draft.fullName?.trim()) {
          ModalManager.warning({ title: 'Campo requerido', message: 'El nombre es obligatorio.' });
          return false;
        }
        existing ? updateSignatory(existing.id, draft) : addSignatory(draft);
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">
          Agrega las personas que deberán firmar el documento en el PDF.
        </p>
        <button
          type="button"
          onClick={() => openForm()}
          className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-theme text-xs font-medium shadow-sm"
        >
          <Icon name="plus" className="mr-1" />
          Agregar firmante
        </button>
      </div>

      {signatories.length === 0 ? (
        <div className="flex items-center justify-center py-6 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 transition-theme">
          <p className="text-xs text-gray-400 dark:text-gray-600 italic">Sin firmantes configurados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {signatories.map(sig => (
            <div
              key={sig.id}
              className="rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-4 bg-gray-50/50 dark:bg-gray-900/30 transition-theme"
            >
              {/* Vista previa del cuadro de firma */}
              <div className="h-10 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 mb-3 transition-theme" />
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme">{sig.fullName}</p>
              {sig.role && <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">{sig.role}</p>}
              {sig.area && <p className="text-xs text-gray-400 dark:text-gray-600 transition-theme">{sig.area}</p>}
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => openForm(sig)}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-theme text-xs text-center"
                >
                  <Icon name="edit" className="mr-1" />Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ModalManager.confirm({
                      title: 'Eliminar firmante',
                      message: `¿Eliminar a "${sig.fullName}"?`,
                      confirmText: 'Eliminar',
                      onConfirm: () => deleteSignatory(sig.id),
                    });
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-theme text-xs"
                >
                  <Icon name="delete" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────

const PDF_SHEETS = [
  {
    key:         'coverPage',
    title:       'Portada',
    description: 'Primera hoja visual con logos, título del proyecto y elaborador.',
    icon:        'fileLines',
    ConfigComponent: CoverPageConfig,
  },
  {
    key:         'summarySheet',
    title:       'Carátula / Ficha',
    description: 'Tabla resumen de la minuta: cliente, proyecto, versión, fecha, estado.',
    icon:        'clipboardList',
    ConfigComponent: SummarySheetConfig,
  },
  {
    key:         'versionControl',
    title:       'Control de Versiones',
    description: 'Historial de versiones del documento generado desde la Línea de Tiempo.',
    icon:        'history',
    ConfigComponent: VersionControlConfig,
  },
  {
    key:         'signaturePage',
    title:       'Firmas / Aprobación',
    description: 'Hoja con cuadros de firma para los participantes clave.',
    icon:        'pen',
    ConfigComponent: SignaturePageConfig,
  },
];

const MinuteEditorSectionPdfFormat = () => {
  const { pdfFormat, togglePdfSheet } = useMinuteEditorStore();
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
              Activa las hojas adicionales que se incluirán al generar el PDF. El contenido del editor no cambia.
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/50 dark:border-gray-700/50 transition-theme">
            <Icon name="fileLines" className="text-primary-500 dark:text-primary-400 text-sm" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme">
              {enabledCount} de {PDF_SHEETS.length} hojas activas
            </span>
          </div>
        </div>
      </div>

      {/* Hojas configurables */}
      <div className="space-y-4">
        {PDF_SHEETS.map(({ key, title, description, icon, ConfigComponent }) => (
          <SheetToggleCard
            key={key}
            title={title}
            description={description}
            icon={icon}
            enabled={pdfFormat[key]?.enabled ?? false}
            onToggle={() => togglePdfSheet(key)}
          >
            <ConfigComponent />
          </SheetToggleCard>
        ))}
      </div>

    </div>
  );
};

export default MinuteEditorSectionPdfFormat;