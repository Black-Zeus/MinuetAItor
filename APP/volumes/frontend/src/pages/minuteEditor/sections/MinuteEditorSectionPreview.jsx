/**
 * pages/minuteEditor/sections/MinuteEditorSectionPreview.jsx
 *
 * - Header con botón "Vista Previa" → modal PDF simulado.
 * - Formulario de envío:
 *   - Participantes del store únicamente (solo desmarcar, no agregar externos).
 *   - Sin CC externo adicional.
 *   - Asunto, nota adicional, adjuntar PDF.
 *   - Botón "Enviar Minuta" → modal de confirmación → toast success.
 */

import React, { useState, useMemo, useEffect } from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';

// ─────────────────────────────────────────────────────────────
// Toast interno (sin dependencia externa)
// ─────────────────────────────────────────────────────────────

let _toastTimeout = null;

const Toast = ({ visible, onHide }) => {
  useEffect(() => {
    if (visible) {
      clearTimeout(_toastTimeout);
      _toastTimeout = setTimeout(onHide, 3500);
    }
    return () => clearTimeout(_toastTimeout);
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-green-600 text-white shadow-2xl animate-fade-in-up">
      <Icon name="check" className="text-base shrink-0" />
      <div>
        <p className="text-sm font-bold">Minuta enviada</p>
        <p className="text-xs opacity-80">Los destinatarios recibirán el correo en breve. (simulado)</p>
      </div>
      <button type="button" onClick={onHide} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
        <Icon name="xmark" className="text-sm" />
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const Badge = ({ label, color = 'gray' }) => {
  const palette = {
    blue:   'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-700/50',
    green:  'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/50 dark:border-green-700/50',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200/50 dark:border-purple-700/50',
    gray:   'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200/50 dark:border-gray-700/50',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border transition-theme ${palette[color] ?? palette.gray}`}>
      {label}
    </span>
  );
};

const TYPE_INFO = {
  attendee: { label: 'Asistente', color: 'green'  },
  invited:  { label: 'Invitado',  color: 'blue'   },
  copy:     { label: 'CC',        color: 'purple'  },
};

// ─────────────────────────────────────────────────────────────
// Contenido modal Vista Previa PDF
// ─────────────────────────────────────────────────────────────

const PdfPreviewContent = ({ meetingInfo, meetingTimes, participants, agreements, requirements, timeline }) => {
  const currentVersion = useMemo(() => {
    const sorted = [...timeline].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    return sorted[0]?.version ?? 'v1.0';
  }, [timeline]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-700/40 transition-theme">
        <Icon name="triangleExclamation" className="text-amber-500 shrink-0 text-xs" />
        <p className="text-xs text-amber-800 dark:text-amber-300 transition-theme">
          Vista previa aproximada. El PDF real puede diferir según el template configurado.
        </p>
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 rounded-xl p-4 transition-theme">
        <div className="mx-auto bg-white shadow-xl rounded" style={{ maxWidth: '620px', minHeight: '800px', fontFamily: 'sans-serif' }}>

          <div style={{ background: '#1d4ed8', color: 'white', padding: '24px 32px' }}>
            <p style={{ fontSize: '10px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Minuta de Reunión</p>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '6px 0 2px' }}>{meetingInfo.subject || 'Sin asunto'}</h1>
            <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>{meetingInfo.client || 'Sin cliente'}</p>
            <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '11px', opacity: 0.85 }}>
              <span>📅 {meetingInfo.meetingDate || '—'}</span>
              <span>📍 {meetingInfo.location || '—'}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 'bold', fontSize: '14px' }}>{currentVersion}</span>
            </div>
          </div>

          <div style={{ padding: '24px 32px', fontSize: '11px', color: '#374151', lineHeight: 1.6 }}>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px' }}>INFORMACIÓN GENERAL</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
                <div><span style={{ color: '#9ca3af' }}>Inicio real: </span>{meetingTimes.actualStart || meetingTimes.scheduledStart || '—'}</div>
                <div><span style={{ color: '#9ca3af' }}>Término real: </span>{meetingTimes.actualEnd || meetingTimes.scheduledEnd || '—'}</div>
                <div><span style={{ color: '#9ca3af' }}>Elaborado por: </span>{meetingInfo.preparedBy || '—'}</div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px' }}>PARTICIPANTES ({participants.length})</p>
              {participants.length === 0
                ? <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin participantes.</p>
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <thead><tr style={{ background: '#f9fafb' }}>{['Nombre','Email','Tipo'].map(h => <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontWeight: '600', color: '#6b7280' }}>{h}</th>)}</tr></thead>
                    <tbody>{participants.map(p => <tr key={p.id} style={{ borderTop: '1px solid #e5e7eb' }}><td style={{ padding: '4px 8px' }}>{p.fullName || p.name || '—'}</td><td style={{ padding: '4px 8px', color: '#6b7280' }}>{p.email || '—'}</td><td style={{ padding: '4px 8px', color: '#6b7280' }}>{TYPE_INFO[p.type]?.label ?? p.type}</td></tr>)}</tbody>
                  </table>
                )
              }
            </div>

            {agreements.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px' }}>ACUERDOS ({agreements.length})</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead><tr style={{ background: '#f9fafb' }}>{['ID','Asunto','Responsable','Vence'].map(h => <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontWeight: '600', color: '#6b7280' }}>{h}</th>)}</tr></thead>
                  <tbody>{agreements.map((a, i) => <tr key={a.id} style={{ borderTop: '1px solid #e5e7eb' }}><td style={{ padding: '4px 8px', color: '#2563eb', fontFamily: 'monospace' }}>{a.agreementId || `AGR-${String(i+1).padStart(3,'0')}`}</td><td style={{ padding: '4px 8px' }}>{a.subject}</td><td style={{ padding: '4px 8px', color: '#6b7280' }}>{a.responsible}</td><td style={{ padding: '4px 8px', color: '#6b7280' }}>{a.dueDate || '—'}</td></tr>)}</tbody>
                </table>
              </div>
            )}

            {requirements.length > 0 && (
              <div>
                <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px' }}>REQUERIMIENTOS ({requirements.length})</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead><tr style={{ background: '#f9fafb' }}>{['ID','Entidad','Descripción','Prioridad'].map(h => <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontWeight: '600', color: '#6b7280' }}>{h}</th>)}</tr></thead>
                  <tbody>{requirements.map((r, i) => <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}><td style={{ padding: '4px 8px', color: '#7c3aed', fontFamily: 'monospace' }}>{r.requirementId || `REQ-${String(i+1).padStart(3,'0')}`}</td><td style={{ padding: '4px 8px' }}>{r.entity}</td><td style={{ padding: '4px 8px', color: '#6b7280' }}>{r.body}</td><td style={{ padding: '4px 8px', color: '#6b7280' }}>{r.priority}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 32px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
            <span>MinuetAItor — documento generado automáticamente</span>
            <span>{currentVersion}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Modal de confirmación de envío
// ─────────────────────────────────────────────────────────────

const ConfirmSendContent = ({ recipientCount, subject, attachPdf, onConfirm, onCancel }) => (
  <div className="flex flex-col gap-5">
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0 transition-theme">
        <Icon name="paperPlane" className="text-primary-600 dark:text-primary-400 text-xl" />
      </div>
      <div>
        <p className="text-base font-bold text-gray-900 dark:text-white transition-theme">¿Confirmar envío?</p>
        <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme mt-1">
          Se enviará la minuta a <span className="font-semibold text-gray-900 dark:text-white">{recipientCount} destinatario{recipientCount !== 1 ? 's' : ''}</span>.
        </p>
      </div>
    </div>

    {/* Resumen */}
    <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200/50 dark:border-gray-700/50 p-4 space-y-2.5 transition-theme">
      <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 transition-theme">
        <Icon name="envelope" className="text-gray-400 shrink-0" />
        <span className="font-mono truncate">{subject}</span>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 transition-theme">
        <Icon name="users" className="text-gray-400 shrink-0" />
        <span>{recipientCount} destinatario{recipientCount !== 1 ? 's' : ''} seleccionados</span>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 transition-theme">
        <Icon name={attachPdf ? 'fileLines' : 'ban'} className={attachPdf ? 'text-primary-500' : 'text-gray-400'} />
        <span>{attachPdf ? 'PDF adjunto incluido' : 'Sin PDF adjunto'}</span>
      </div>
    </div>

    {/* Aviso mockup */}
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-700/40 transition-theme">
      <Icon name="triangleExclamation" className="text-amber-500 text-xs shrink-0" />
      <p className="text-xs text-amber-800 dark:text-amber-300 transition-theme">
        Envío simulado — el módulo de correo real se habilitará próximamente.
      </p>
    </div>

    {/* Botones */}
    <div className="flex justify-end gap-3 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-semibold transition-theme"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-all shadow-md"
      >
        <Icon name="paperPlane" />
        Confirmar envío
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Formulario de Envío
// ─────────────────────────────────────────────────────────────

const EmailForm = () => {
  const { meetingInfo, participants } = useMinuteEditorStore();

  const [subject,   setSubject]   = useState(`Minuta de Reunión: ${meetingInfo.subject || 'Reunión'}`);
  const [bodyNote,  setBodyNote]  = useState('');
  const [attachPdf, setAttachPdf] = useState(true);
  const [sent,      setSent]      = useState(false);
  const [toast,     setToast]     = useState(false);
  const [selected,  setSelected]  = useState(() => new Set(participants.map(p => p.id)));

  const toggleParticipant = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const recipientCount = selected.size;

  const toList = participants.filter(p => p.type !== 'copy');
  const ccList = participants.filter(p => p.type === 'copy');

  const handleSendClick = () => {
    ModalManager.custom({
      title:      'Envío de Minuta',
      size:       'medium',
      showFooter: false,
      content: (
        <ConfirmSendContent
          recipientCount={recipientCount}
          subject={subject}
          attachPdf={attachPdf}
          onCancel={() => ModalManager.close()}
          onConfirm={() => {
            ModalManager.close();
            setSent(true);
            setTimeout(() => setToast(true), 300);
          }}
        />
      ),
    });
  };

  const ParticipantRow = ({ p }) => {
    const info    = TYPE_INFO[p.type] ?? TYPE_INFO.invited;
    const checked = selected.has(p.id);
    return (
      <label className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-theme ${checked ? 'bg-gray-50 dark:bg-gray-900/40' : 'opacity-40'}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => toggleParticipant(p.id)}
          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate transition-theme">{p.fullName || p.name || '—'}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate transition-theme">
            {p.email || <span className="italic">Sin correo registrado</span>}
          </p>
        </div>
        <Badge label={info.label} color={info.color} />
      </label>
    );
  };

  return (
    <>
      <Toast visible={toast} onHide={() => setToast(false)} />

      <div className="grid grid-cols-12 gap-6">

        {/* Columna destinatarios */}
        <div className="col-span-12 lg:col-span-5">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm transition-theme">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 flex items-center gap-2 transition-theme">
                <Icon name="users" className="text-primary-500" />
                Destinatarios
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono transition-theme">
                {selected.size}/{participants.length}
              </span>
            </div>

            {participants.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-600 italic px-1 transition-theme">
                No hay participantes. Agrégalos en la pestaña "Participantes".
              </p>
            ) : (
              <div className="space-y-1">
                {toList.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider px-1 mb-1 transition-theme">Asistentes / Invitados</p>
                    {toList.map(p => <ParticipantRow key={p.id} p={p} />)}
                  </>
                )}
                {ccList.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider px-1 mt-3 mb-1 transition-theme">Con Copia (CC)</p>
                    {ccList.map(p => <ParticipantRow key={p.id} p={p} />)}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Columna mensaje */}
        <div className="col-span-12 lg:col-span-7 space-y-4">

          {/* Asunto */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm transition-theme">
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 transition-theme">Asunto del correo</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          {/* Nota */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm transition-theme">
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 transition-theme">
              Nota adicional <span className="normal-case font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              rows={5}
              value={bodyNote}
              onChange={e => setBodyNote(e.target.value)}
              placeholder="Mensaje que se incluirá al inicio del correo…"
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
            />
          </div>

          {/* Adjuntar PDF */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm transition-theme">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={attachPdf}
                onChange={e => setAttachPdf(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme">Adjuntar PDF de la minuta</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">Se generará según la configuración en "Formato PDF".</p>
              </div>
            </label>
          </div>

          {/* Acción */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm transition-theme">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{recipientCount}</span> destinatario{recipientCount !== 1 ? 's' : ''} seleccionados
              </p>

              {sent ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200/60 dark:border-green-700/40 transition-theme">
                  <Icon name="check" className="text-green-600 dark:text-green-400" />
                  <span className="text-sm font-semibold text-green-800 dark:text-green-300">Enviado (simulado)</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSendClick}
                  disabled={recipientCount === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-md"
                >
                  <Icon name="paperPlane" />
                  Enviar Minuta
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────

const MinuteEditorSectionPreview = () => {
  const { meetingInfo, meetingTimes, participants, agreements, requirements, timeline } = useMinuteEditorStore();

  const openPdfPreview = () => {
    ModalManager.custom({
      title:      'Vista Previa — Minuta',
      size:       'large',
      showFooter: false,
      content: (
        <PdfPreviewContent
          meetingInfo={meetingInfo}
          meetingTimes={meetingTimes}
          participants={participants}
          agreements={agreements}
          requirements={requirements}
          timeline={timeline}
        />
      ),
    });
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-md transition-theme">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
              <Icon name="paperPlane" className="text-primary-600 dark:text-primary-400" />
              Envío de Minuta
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme mt-0.5">
              Configura los destinatarios y envía la minuta por correo electrónico.
            </p>
          </div>
          <button
            type="button"
            onClick={openPdfPreview}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-semibold border border-gray-200/50 dark:border-gray-600/50 transition-theme shadow-sm shrink-0"
          >
            <Icon name="eye" className="text-primary-600 dark:text-primary-400" />
            Vista Previa
          </button>
        </div>

        <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-700/40 transition-theme">
          <Icon name="triangleExclamation" className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0 text-xs" />
          <p className="text-xs text-amber-800 dark:text-amber-300 transition-theme">
            <span className="font-semibold">Módulo en construcción.</span> El envío real por correo se habilitará en una próxima versión.
          </p>
        </div>
      </div>

      <EmailForm />
    </div>
  );
};

export default MinuteEditorSectionPreview;