import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';
import { sendMinuteEmail } from '@/services/minutesService';
import { toastSuccess } from '@/components/common/toast/toastHelpers';

const SEND_ALLOWED_STATUSES = new Set(['preview', 'completed']);

const TYPE_INFO = {
  attendee: { label: 'Asistente', color: 'green' },
  invited: { label: 'Invitado', color: 'blue' },
  copy: { label: 'CC', color: 'purple' },
};

const Badge = ({ label, color = 'gray' }) => {
  const palette = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-700/50',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/50 dark:border-green-700/50',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200/50 dark:border-purple-700/50',
    gray: 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200/50 dark:border-gray-700/50',
  };

  return (
    <span className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-theme ${palette[color] ?? palette.gray}`}>
      {label}
    </span>
  );
};

const PdfPreviewContent = ({ meetingInfo, meetingTimes, participants, agreements, requirements, timeline }) => {
  const currentVersion = useMemo(() => {
    const sorted = [...timeline].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    return sorted[0]?.version ?? 'v1.0';
  }, [timeline]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-2.5 transition-theme dark:border-amber-700/40 dark:bg-amber-900/15">
        <Icon name="triangleExclamation" className="shrink-0 text-xs text-amber-500" />
        <p className="text-xs text-amber-800 transition-theme dark:text-amber-300">
          Vista previa aproximada. El PDF real puede diferir según el template configurado.
        </p>
      </div>

      <div className="flex-1 overflow-auto rounded-xl bg-gray-100 p-4 transition-theme dark:bg-gray-900">
        <div className="mx-auto rounded bg-white shadow-xl" style={{ maxWidth: '620px', minHeight: '800px', fontFamily: 'sans-serif' }}>
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
              {participants.length === 0 ? (
                <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin participantes.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead><tr style={{ background: '#f9fafb' }}>{['Nombre', 'Email', 'Tipo'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontWeight: '600', color: '#6b7280' }}>{h}</th>)}</tr></thead>
                  <tbody>{participants.map((p) => <tr key={p.id} style={{ borderTop: '1px solid #e5e7eb' }}><td style={{ padding: '4px 8px' }}>{p.fullName || p.name || '—'}</td><td style={{ padding: '4px 8px', color: '#6b7280' }}>{p.email || '—'}</td><td style={{ padding: '4px 8px', color: '#6b7280' }}>{TYPE_INFO[p.type]?.label ?? p.type}</td></tr>)}</tbody>
                </table>
              )}
            </div>

            {agreements.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px' }}>ACUERDOS ({agreements.length})</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead><tr style={{ background: '#f9fafb' }}>{['ID', 'Asunto', 'Responsable', 'Vence'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontWeight: '600', color: '#6b7280' }}>{h}</th>)}</tr></thead>
                  <tbody>{agreements.map((a, i) => <tr key={a.id} style={{ borderTop: '1px solid #e5e7eb' }}><td style={{ padding: '4px 8px', color: '#2563eb', fontFamily: 'monospace' }}>{a.agreementId || `AGR-${String(i + 1).padStart(3, '0')}`}</td><td style={{ padding: '4px 8px' }}>{a.subject}</td><td style={{ padding: '4px 8px', color: '#6b7280' }}>{a.responsible}</td><td style={{ padding: '4px 8px', color: '#6b7280' }}>{a.dueDate || '—'}</td></tr>)}</tbody>
                </table>
              </div>
            )}

            {requirements.length > 0 && (
              <div>
                <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px' }}>REQUERIMIENTOS ({requirements.length})</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead><tr style={{ background: '#f9fafb' }}>{['ID', 'Entidad', 'Descripción', 'Prioridad'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontWeight: '600', color: '#6b7280' }}>{h}</th>)}</tr></thead>
                  <tbody>{requirements.map((r, i) => <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}><td style={{ padding: '4px 8px', color: '#7c3aed', fontFamily: 'monospace' }}>{r.requirementId || `REQ-${String(i + 1).padStart(3, '0')}`}</td><td style={{ padding: '4px 8px' }}>{r.entity}</td><td style={{ padding: '4px 8px', color: '#6b7280' }}>{r.body}</td><td style={{ padding: '4px 8px', color: '#6b7280' }}>{r.priority}</td></tr>)}</tbody>
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

const ConfirmSendContent = ({ recipientCount, subject, attachPdf, onConfirm, onCancel, sending }) => (
  <div className="flex flex-col gap-5">
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 transition-theme dark:bg-primary-900/20">
        <Icon name="paperPlane" className="text-xl text-primary-600 dark:text-primary-400" />
      </div>
      <div>
        <p className="text-base font-bold text-gray-900 transition-theme dark:text-white">¿Confirmar envío?</p>
        <p className="mt-1 text-sm text-gray-600 transition-theme dark:text-gray-300">
          Se enviará la minuta a <span className="font-semibold text-gray-900 dark:text-white">{recipientCount} destinatario{recipientCount !== 1 ? 's' : ''}</span>.
        </p>
      </div>
    </div>

    <div className="space-y-2.5 rounded-xl border border-gray-200/50 bg-gray-50 p-4 transition-theme dark:border-gray-700/50 dark:bg-gray-900/40">
      <div className="flex items-center gap-3 text-sm text-gray-700 transition-theme dark:text-gray-300">
        <Icon name="envelope" className="shrink-0 text-gray-400" />
        <span className="truncate font-mono">{subject}</span>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-700 transition-theme dark:text-gray-300">
        <Icon name="users" className="shrink-0 text-gray-400" />
        <span>{recipientCount} destinatario{recipientCount !== 1 ? 's' : ''} seleccionados</span>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-700 transition-theme dark:text-gray-300">
        <Icon name={attachPdf ? 'fileLines' : 'ban'} className={attachPdf ? 'text-primary-500' : 'text-gray-400'} />
        <span>{attachPdf ? 'PDF adjunto incluido' : 'Sin PDF adjunto'}</span>
      </div>
    </div>

    <div className="flex justify-end gap-3 pt-1">
      <button
        type="button"
        onClick={onCancel}
        disabled={sending}
        className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 transition-theme hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={sending}
        className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon name={sending ? 'spinner' : 'paperPlane'} className={sending ? 'animate-spin' : ''} />
        {sending ? 'Enviando...' : 'Confirmar envío'}
      </button>
    </div>
  </div>
);

const EmailForm = ({ recordId, recordStatus, isReadOnly }) => {
  const {
    meetingInfo,
    participants,
    additionalNote,
    setAdditionalNote,
  } = useMinuteEditorStore();

  const [subject, setSubject] = useState(`Minuta de Reunión: ${meetingInfo.subject || 'Reunión'}`);
  const [attachPdf, setAttachPdf] = useState(true);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState(() => new Set((participants || []).filter((participant) => participant.email).map((participant) => participant.id)));

  useEffect(() => {
    if (!subject.trim()) {
      setSubject(`Minuta de Reunión: ${meetingInfo.subject || 'Reunión'}`);
    }
  }, [meetingInfo.subject, subject]);

  useEffect(() => {
    const participantIds = new Set(participants.map((participant) => participant.id));
    setSelected((prev) => {
      const next = new Set();
      participants.forEach((participant) => {
        if (!participant.email) return;
        if (prev.has(participant.id)) next.add(participant.id);
      });
      prev.forEach((id) => {
        if (participantIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [participants]);

  const selectableParticipants = participants.filter((participant) => participant.email);
  const selectedParticipants = participants.filter((participant) => participant.email && selected.has(participant.id));
  const directRecipientCount = selectedParticipants.filter((participant) => participant.type !== 'copy').length;
  const recipientCount = selectedParticipants.length;
  const toList = participants.filter((participant) => participant.type !== 'copy');
  const ccList = participants.filter((participant) => participant.type === 'copy');
  const canEditSendOptions = !sending && (!isReadOnly || SEND_ALLOWED_STATUSES.has(recordStatus));

  const toggleParticipant = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const executeSend = async () => {
    setSending(true);
    try {
      if (!SEND_ALLOWED_STATUSES.has(recordStatus)) {
        ModalManager.warning({
          title: 'Envío no disponible',
          message: 'La minuta solo puede enviarse por correo cuando está en estado preview o completed.',
        });
        return;
      }

      if (directRecipientCount === 0) {
        ModalManager.error({
          title: 'Destinatarios incompletos',
          message: 'Selecciona al menos un destinatario principal con correo válido antes de enviar.',
        });
        return;
      }

      const reviewEmail = {
        subject: subject.trim(),
        bodyNote: additionalNote?.trim() || null,
        attachPdf,
        selectedParticipantIds: [...selected],
      };

      await sendMinuteEmail(recordId, reviewEmail);
      ModalManager.closeAll?.();
      toastSuccess('Minuta enviada', 'El correo quedó encolado para los destinatarios seleccionados.');
    } catch (err) {
      ModalManager.error({
        title: 'Error al enviar',
        message: err?.message ?? 'No fue posible enviar la minuta por correo.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendClick = () => {
    if (!recordId || sending) return;

    if (!SEND_ALLOWED_STATUSES.has(recordStatus)) {
      ModalManager.warning({
        title: 'Envío no disponible',
        message: 'La minuta todavía está en edición. Solo podrás enviarla por mail cuando ya esté lista para revisión o finalizada.',
      });
      return;
    }

    if (recipientCount === 0 || directRecipientCount === 0) {
      ModalManager.error({
        title: 'Destinatarios incompletos',
        message: 'Selecciona al menos un destinatario principal con correo válido antes de enviar.',
      });
      return;
    }

    ModalManager.custom({
      title: 'Envío de Minuta',
      size: 'medium',
      showFooter: false,
      content: (
        <ConfirmSendContent
          recipientCount={recipientCount}
          subject={subject}
          attachPdf={attachPdf}
          sending={sending}
          onCancel={() => ModalManager.closeAll?.()}
          onConfirm={executeSend}
        />
      ),
    });
  };

  const ParticipantRow = ({ participant }) => {
    const info = TYPE_INFO[participant.type] ?? TYPE_INFO.invited;
    const checked = selected.has(participant.id);
    return (
      <label className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-theme ${checked ? 'bg-gray-50 dark:bg-gray-900/40' : 'opacity-40'}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={!participant.email || !canEditSendOptions}
          onChange={() => toggleParticipant(participant.id)}
          className="h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 transition-theme dark:text-gray-100">{participant.fullName || participant.name || '—'}</p>
          <p className="truncate text-xs text-gray-400 transition-theme dark:text-gray-500">
            {participant.email || <span className="italic">Sin correo registrado</span>}
          </p>
        </div>
        <Badge label={info.label} color={info.color} />
      </label>
    );
  };

  return (
    <>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5">
          <div className="rounded-xl border border-gray-200/50 bg-white p-5 shadow-sm transition-theme dark:border-gray-700/50 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 transition-theme dark:text-gray-400">
                <Icon name="users" className="text-primary-500" />
                Destinatarios
              </h3>
              <span className="font-mono text-xs text-gray-400 transition-theme dark:text-gray-500">
                {recipientCount}/{selectableParticipants.length}
              </span>
            </div>

            {participants.length === 0 ? (
              <p className="px-1 text-xs italic text-gray-400 transition-theme dark:text-gray-600">
                No hay participantes. Agrégalos en la pestaña "Participantes".
              </p>
            ) : (
              <div className="space-y-1">
                {toList.length > 0 && (
                  <>
                    <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400 transition-theme dark:text-gray-600">Asistentes / Invitados</p>
                    {toList.map((participant) => <ParticipantRow key={participant.id} participant={participant} />)}
                  </>
                )}
                {ccList.length > 0 && (
                  <>
                    <p className="mb-1 mt-3 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400 transition-theme dark:text-gray-600">Con Copia (CC)</p>
                    {ccList.map((participant) => <ParticipantRow key={participant.id} participant={participant} />)}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 space-y-4 lg:col-span-7">
          <div className="rounded-xl border border-gray-200/50 bg-white p-5 shadow-sm transition-theme dark:border-gray-700/50 dark:bg-gray-800">
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500 transition-theme dark:text-gray-400">Asunto del correo</label>
            <input
              type="text"
              value={subject}
              disabled={!canEditSendOptions}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="rounded-xl border border-gray-200/50 bg-white p-5 shadow-sm transition-theme dark:border-gray-700/50 dark:bg-gray-800">
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500 transition-theme dark:text-gray-400">
              Nota adicional <span className="font-normal normal-case text-gray-400">(opcional)</span>
            </label>
            <textarea
              rows={5}
              value={additionalNote}
              disabled={!canEditSendOptions}
              onChange={(e) => setAdditionalNote(e.target.value)}
              placeholder="Mensaje que se incluirá al inicio del correo…"
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="rounded-xl border border-gray-200/50 bg-white p-5 shadow-sm transition-theme dark:border-gray-700/50 dark:bg-gray-800">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={attachPdf}
                disabled={!canEditSendOptions}
                onChange={(e) => setAttachPdf(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 transition-theme dark:text-gray-100">Adjuntar PDF de la minuta</p>
                <p className="text-xs text-gray-500 transition-theme dark:text-gray-400">Se usará el PDF de borrador generado con la configuración actual del editor.</p>
              </div>
            </label>
          </div>

          <div className="rounded-xl border border-gray-200/50 bg-white p-5 shadow-sm transition-theme dark:border-gray-700/50 dark:bg-gray-800">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-600 transition-theme dark:text-gray-300">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{recipientCount}</span> destinatario{recipientCount !== 1 ? 's' : ''} con correo válido
              </p>

              <div className="flex items-center gap-3">
                {isReadOnly && (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-200/60 bg-blue-50 px-4 py-2 transition-theme dark:border-blue-700/40 dark:bg-blue-900/20">
                    <Icon name="check" className="text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                      {recordStatus === 'completed' ? 'Minuta oficializada' : 'Enviada a revisión'}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSendClick}
                  disabled={sending}
                  className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name={sending ? 'spinner' : 'paperPlane'} className={sending ? 'animate-spin' : ''} />
                  {sending ? 'Enviando...' : 'Enviar Minuta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const MinuteEditorSectionPreview = ({ recordId, recordStatus, isReadOnly }) => {
  const { meetingInfo, meetingTimes, participants, agreements, requirements, timeline } = useMinuteEditorStore();

  const openPdfPreview = () => {
    ModalManager.custom({
      title: 'Vista Previa — Minuta',
      size: 'large',
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
      <div className="rounded-xl border border-gray-200/50 bg-white p-6 shadow-md transition-theme dark:border-gray-700/50 dark:bg-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 transition-theme dark:text-white">
              <Icon name="paperPlane" className="text-primary-600 dark:text-primary-400" />
              Envío de Minuta
            </h2>
            <p className="mt-0.5 text-sm text-gray-600 transition-theme dark:text-gray-300">
              Configura los destinatarios y envía la minuta por correo electrónico.
            </p>
          </div>
          <button
            type="button"
            onClick={openPdfPreview}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-200/50 bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition-theme hover:bg-gray-200 dark:border-gray-600/50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            <Icon name="eye" className="text-primary-600 dark:text-primary-400" />
            Vista Previa
          </button>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200/60 bg-blue-50 px-4 py-3 transition-theme dark:border-blue-700/40 dark:bg-blue-900/15">
          <Icon name="circleInfo" className="mt-0.5 shrink-0 text-xs text-blue-500 dark:text-blue-400" />
          <p className="text-xs text-blue-800 transition-theme dark:text-blue-300">
            {isReadOnly
              ? 'La minuta ya salió del flujo editable. Esta vista muestra cómo quedó el envío configurado.'
              : 'Al confirmar, el sistema guarda el borrador actual, genera la versión en revisión y encola el correo con los destinatarios seleccionados.'}
          </p>
        </div>
      </div>

      <EmailForm
        recordId={recordId}
        recordStatus={recordStatus}
        isReadOnly={isReadOnly}
      />
    </div>
  );
};

export default MinuteEditorSectionPreview;
