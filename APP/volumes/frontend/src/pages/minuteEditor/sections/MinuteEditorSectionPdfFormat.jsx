/**
 * pages/minuteEditor/sections/MinuteEditorSectionPdfFormat.jsx
 * Tab "Formato PDF": configura las hojas adicionales que se incluirán en el PDF.
 *
 * Cambios:
 * - DDL con 5 templates de minuta, descripción dinámica y botón "Vista Previa"
 *   que abre un modal con un PDF simulado (mockup).
 */

import React, { useState } from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';

// ─────────────────────────────────────────────────────────────
// Templates de minuta (mockup)
// ─────────────────────────────────────────────────────────────

const PDF_TEMPLATES = [
  {
    id:          'standard',
    name:        'Estándar Corporativo',
    description: 'Diseño limpio con encabezado de empresa, secciones bien definidas y paleta de colores neutros. Ideal para reuniones internas de seguimiento.',
    thumb:       'layout',
  },
  {
    id:          'executive',
    name:        'Resumen Ejecutivo',
    description: 'Formato condensado de 1–2 páginas. Resalta acuerdos y próximos pasos. Pensado para distribución a gerencia o dirección.',
    thumb:       'briefcase',
  },
  {
    id:          'detailed',
    name:        'Detallado con Actas',
    description: 'Incluye transcripción resumida por sección, tabla de acuerdos extendida y control de firmas. Para proyectos con requerimientos formales de documentación.',
    thumb:       'fileLines',
  },
  {
    id:          'minimalist',
    name:        'Minimalista',
    description: 'Sin colores de relleno, tipografía sobria. Solo texto y estructura. Compatible con impresión en blanco y negro.',
    thumb:       'minus',
  },
  {
    id:          'branded',
    name:        'Con Marca / Branding',
    description: 'Espacios reservados para logotipo del cliente y de la empresa. Colores primarios configurables. Para entrega formal a clientes.',
    thumb:       'star',
  },
];

// ─────────────────────────────────────────────────────────────
// Modal de vista previa de template (mockup PDF)
// ─────────────────────────────────────────────────────────────

const TemplatePreviewContent = ({ template, meetingInfo }) => (
  <div className="flex flex-col gap-4 h-full">

    {/* Banner mockup */}
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-700/40 transition-theme">
      <Icon name="triangleExclamation" className="text-amber-500 shrink-0 text-xs" />
      <p className="text-xs text-amber-800 dark:text-amber-300 transition-theme">
        Vista previa aproximada del template <strong>{template.name}</strong>. El PDF real puede diferir en tipografía y espaciado.
      </p>
    </div>

    {/* Simulación de página PDF */}
    <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 rounded-xl p-4 transition-theme">
      <div
        className="mx-auto bg-white shadow-xl rounded"
        style={{ width: '100%', maxWidth: '600px', minHeight: '800px', fontFamily: 'sans-serif' }}
      >
        {/* Encabezado del template */}
        {template.id === 'standard' && (
          <div style={{ background: '#1d4ed8', color: 'white', padding: '24px 32px' }}>
            <p style={{ fontSize: '10px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '2px' }}>Minuta de Reunión</p>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0 0' }}>{meetingInfo?.subject || 'Asunto de la reunión'}</h1>
            <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>{meetingInfo?.client || 'Cliente'}</p>
          </div>
        )}
        {template.id === 'executive' && (
          <div style={{ borderBottom: '4px solid #1d4ed8', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Resumen Ejecutivo</p>
              <h1 style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginTop: '4px' }}>{meetingInfo?.subject || 'Reunión'}</h1>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '10px', color: '#6b7280' }}>Cliente</p>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{meetingInfo?.client || '—'}</p>
            </div>
          </div>
        )}
        {template.id === 'detailed' && (
          <div style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb', padding: '24px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: '#1d4ed8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>M</span>
              </div>
              <div>
                <h1 style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>{meetingInfo?.subject || 'Reunión'}</h1>
                <p style={{ fontSize: '11px', color: '#6b7280' }}>Minuta Oficial · {meetingInfo?.client || 'Cliente'}</p>
              </div>
            </div>
          </div>
        )}
        {template.id === 'minimalist' && (
          <div style={{ padding: '32px 40px', borderBottom: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase' }}>Minuta de Reunión</p>
            <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginTop: '8px', lineHeight: '1.3' }}>{meetingInfo?.subject || 'Asunto'}</h1>
          </div>
        )}
        {template.id === 'branded' && (
          <div style={{ background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)', color: 'white', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ width: '80px', height: '24px', background: 'rgba(255,255,255,0.3)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '8px', opacity: 0.8 }}>LOGO</span>
              </div>
              <div style={{ width: '60px', height: '20px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '7px', opacity: 0.7 }}>CLIENTE</span>
              </div>
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>{meetingInfo?.subject || 'Reunión'}</h1>
            <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>{meetingInfo?.client}</p>
          </div>
        )}

        {/* Cuerpo genérico simulado */}
        <div style={{ padding: '24px 32px', fontSize: '11px', color: '#374151', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px' }}>
              INFORMACIÓN GENERAL
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
              <div><span style={{ color: '#9ca3af' }}>Fecha:</span> {meetingInfo?.meetingDate || '—'}</div>
              <div><span style={{ color: '#9ca3af' }}>Lugar:</span> {meetingInfo?.location || '—'}</div>
              <div><span style={{ color: '#9ca3af' }}>Elaborado por:</span> {meetingInfo?.preparedBy || '—'}</div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px' }}>
              ALCANCE Y CONTENIDO
            </p>
            {[1, 2, 3].map(n => (
              <div key={n} style={{ marginBottom: '8px' }}>
                <p style={{ fontWeight: '600', color: '#111827' }}>Sección de ejemplo {n}</p>
                <p style={{ color: '#6b7280', fontSize: '10px' }}>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean euismod bibendum laoreet.</p>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px' }}>
              ACUERDOS
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: '#6b7280', fontWeight: '600' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: '#6b7280', fontWeight: '600' }}>Asunto</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: '#6b7280', fontWeight: '600' }}>Responsable</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', color: '#6b7280', fontWeight: '600' }}>Vence</th>
                </tr>
              </thead>
              <tbody>
                {[['AGR-001','Ejemplo de acuerdo','Juan Pérez','15/03/2026'],['AGR-002','Otro acuerdo','María López','30/03/2026']].map(([id,subject,resp,due]) => (
                  <tr key={id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '4px 8px', color: '#2563eb', fontFamily: 'monospace' }}>{id}</td>
                    <td style={{ padding: '4px 8px' }}>{subject}</td>
                    <td style={{ padding: '4px 8px', color: '#6b7280' }}>{resp}</td>
                    <td style={{ padding: '4px 8px', color: '#6b7280' }}>{due}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie de página */}
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 32px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
          <span>MinuetAItor — {template.name}</span>
          <span>Página 1 de N</span>
        </div>
      </div>
    </div>

  </div>
);

// ─────────────────────────────────────────────────────────────
// Selector de template
// ─────────────────────────────────────────────────────────────

const TemplateSelector = ({ selectedId, onChange }) => {
  const { meetingInfo } = useMinuteEditorStore();
  const selected = PDF_TEMPLATES.find(t => t.id === selectedId) ?? PDF_TEMPLATES[0];

  const openPreview = () => {
    ModalManager.custom({
      title:      `Vista Previa — ${selected.name}`,
      size:       'large',
      showFooter: false,
      content:    <TemplatePreviewContent template={selected} meetingInfo={meetingInfo} />,
    });
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
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-all shadow-sm shrink-0"
        >
          <Icon name="eye" className="text-xs" />
          Vista Previa
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

const SheetToggleCard = ({ title, description, icon, enabled, onToggle, children }) => (
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
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none
          ${enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`}
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

const SignaturePageConfig = () => {
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
        <button
          type="button"
          onClick={() => openForm()}
          className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-all shadow-sm shrink-0"
        >
          <Icon name="plus" className="mr-1" />
          Agregar
        </button>
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
                <button type="button" onClick={() => openForm(sig)} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-theme"><Icon name="pen" className="text-xs" /></button>
                <button type="button" onClick={() => deleteSignatory(sig.id)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-500 dark:text-gray-400 hover:text-red-600 transition-theme"><Icon name="trash" className="text-xs" /></button>
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

const MinuteEditorSectionPdfFormat = () => {
  const { pdfFormat, togglePdfSheet } = useMinuteEditorStore();
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
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
          <TemplateSelector selectedId={selectedTemplate} onChange={setSelectedTemplate} />
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
          >
            <ConfigComponent />
          </SheetToggleCard>
        ))}
      </div>

    </div>
  );
};

export default MinuteEditorSectionPdfFormat;