/**
 * pages/minuteEditor/sections/MinuteEditorSectionParticipants.jsx
 * Tab "Participantes": tabla editable con modal para crear/editar.
 *
 * Cambios:
 * - Formulario incluye campo "Email" (mockup — campo almacenado en store, sin lógica de BD aún).
 * - Tabla muestra columna Email.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';
import participantsService from '@/services/participantsService';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS = {
  invited:  { label: 'Invitado',   color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-700/50' },
  attendee: { label: 'Asistente',  color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/50 dark:border-green-700/50' },
  copy:     { label: 'CC',         color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200/50 dark:border-purple-700/50' },
};

const normalizeInitialData = (data = {}) => ({
  fullName: data.fullName ?? data.name ?? '',
  email: data.email ?? '',
  type: data.type ?? 'invited',
  participantId: data.participantId ?? null,
  participantEmailId: data.participantEmailId ?? null,
  participantEmails: Array.isArray(data.participantEmails) ? data.participantEmails : [],
  organization: data.organization ?? '',
  title: data.title ?? '',
});

const emailsEqual = (left, right) =>
  String(left ?? '').trim().toLowerCase() === String(right ?? '').trim().toLowerCase();

const pickPrimaryEmail = (emails = []) =>
  emails.find((item) => item.isPrimary || item.is_primary) ?? emails[0] ?? null;

const getParticipantEmailOptions = (participant) => {
  const base = Array.isArray(participant?.participantEmails) ? participant.participantEmails : [];
  const normalized = base.map((item, index) => ({
    id: item.id ?? `email-${index}-${item.email ?? ''}`,
    email: item.email ?? '',
    isPrimary: Boolean(item.isPrimary ?? item.is_primary),
  })).filter((item) => item.email);

  if (participant?.email && !normalized.some((item) => emailsEqual(item.email, participant.email))) {
    normalized.unshift({
      id: 'current-email',
      email: participant.email,
      isPrimary: false,
    });
  }

  return normalized;
};

const ParticipantFormModal = ({ initialData, onSubmit, registerSubmit }) => {
  const [form, setForm] = useState(() => normalizeInitialData(initialData));
  const [matches, setMatches] = useState([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const shouldFetchCurrent =
      form.participantId &&
      (!Array.isArray(form.participantEmails) || form.participantEmails.length === 0);

    if (!shouldFetchCurrent) return undefined;

    setIsLoadingCurrent(true);
    participantsService.getById(form.participantId)
      .then((participant) => {
        if (cancelled || !participant) return;
        const primaryEmail = pickPrimaryEmail(participant.emails);
        setForm((prev) => ({
          ...prev,
          organization: participant.organization ?? prev.organization,
          title: participant.title ?? prev.title,
          participantEmails: participant.emails ?? [],
          participantEmailId: prev.participantEmailId ?? primaryEmail?.id ?? null,
          email: prev.email || primaryEmail?.email || '',
        }));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCurrent(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.participantId, form.participantEmails]);

  useEffect(() => {
    const query = String(form.fullName ?? '').trim();
    if (query.length < 2) {
      setMatches([]);
      setIsLoadingMatches(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setIsLoadingMatches(true);
      participantsService.list({ limit: 6, filters: { search: query, isActive: true } })
        .then((result) => {
          if (cancelled) return;
          setMatches(result.items ?? []);
        })
        .catch(() => {
          if (!cancelled) setMatches([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoadingMatches(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.fullName]);

  const selectedEmailMode = useMemo(() => {
    if (!form.email) return '';
    const matchedOption = (form.participantEmails ?? []).find((item) => emailsEqual(item.email, form.email));
    if (matchedOption) {
      return String(form.participantEmailId ?? matchedOption.id);
    }
    return '__manual__';
  }, [form.email, form.participantEmailId, form.participantEmails]);

  const applyMatchedParticipant = (participant) => {
    const primaryEmail = pickPrimaryEmail(participant.emails);
    setForm((prev) => ({
      ...prev,
      fullName: participant.displayName ?? prev.fullName,
      participantId: participant.id,
      participantEmails: participant.emails ?? [],
      participantEmailId: primaryEmail?.id ?? null,
      email: primaryEmail?.email ?? '',
      organization: participant.organization ?? '',
      title: participant.title ?? '',
    }));
  };

  const handleNameChange = (value) => {
    setForm((prev) => {
      const sameSelectedName =
        prev.participantId &&
        String(prev.fullName ?? '').trim().toLowerCase() === String(value ?? '').trim().toLowerCase();

      if (sameSelectedName) {
        return { ...prev, fullName: value };
      }

      return {
        ...prev,
        fullName: value,
        participantId: null,
        participantEmailId: null,
        participantEmails: [],
      };
    });
  };

  const handleEmailModeChange = (value) => {
    if (value === '__manual__') {
      setForm((prev) => ({ ...prev, participantEmailId: null }));
      return;
    }

    const selected = (form.participantEmails ?? []).find((item) => String(item.id) === String(value));
    if (!selected) return;

    setForm((prev) => ({
      ...prev,
      participantEmailId: selected.id,
      email: selected.email,
    }));
  };

  const submit = async () => {
    const fullName = String(form.fullName ?? '').trim();
    const email = String(form.email ?? '').trim().toLowerCase();

    if (!fullName) {
      ModalManager.warning({
        title: 'Campo requerido',
        message: 'El nombre completo es obligatorio.',
      });
      return false;
    }

    setIsSaving(true);
    try {
      const resolved = await participantsService.resolve({
        participantId: form.participantId,
        displayName: fullName,
        organization: form.organization || null,
        title: form.title || null,
        email: email || null,
      });

      const matchedEmail = (resolved.emails ?? []).find((item) => emailsEqual(item.email, email));

      await onSubmit({
        ...form,
        fullName: resolved.displayName ?? fullName,
        email,
        participantId: resolved.id,
        participantEmailId: matchedEmail?.id ?? null,
        participantEmails: resolved.emails ?? [],
        organization: resolved.organization ?? '',
        title: resolved.title ?? '',
      });
      return true;
    } catch (error) {
      ModalManager.warning({
        title: 'No fue posible guardar',
        message: error?.response?.data?.error?.message ?? error?.message ?? 'No se pudo resolver el participante.',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    registerSubmit?.(submit);
  }, [registerSubmit, submit]);

  return (
    <div className="space-y-4 p-6">
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider transition-theme">
          Nombre completo <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.fullName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Ej: Juan Pérez"
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />

        <div className="mt-2 min-h-5">
          {isLoadingMatches ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 transition-theme">Buscando participantes...</p>
          ) : matches.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {matches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyMatchedParticipant(item)}
                  className="px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-200 hover:border-primary-400 hover:text-primary-600 transition-theme"
                >
                  {item.displayName}
                  {Array.isArray(item.emails) && item.emails.length > 0 ? ` · ${item.emails.length} mail${item.emails.length > 1 ? 's' : ''}` : ' · sin mail'}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 transition-theme">
              Si no existe en el catálogo, se creará al guardar.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider transition-theme">
          Correo electrónico
        </label>

        {(form.participantEmails ?? []).length > 0 && (
          <select
            value={selectedEmailMode}
            onChange={(e) => handleEmailModeChange(e.target.value)}
            className="w-full mb-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          >
            {(form.participantEmails ?? []).map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.email}
              </option>
            ))}
            <option value="__manual__">Escribir otro correo</option>
          </select>
        )}

        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value, participantEmailId: null }))}
          placeholder="correo@empresa.com"
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-theme">
          El correo que dejes aquí quedará guardado en esta versión de la minuta. Si el participante existe, también se intentará asociar al catálogo maestro.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider transition-theme">
          Tipo de participación <span className="text-red-500">*</span>
        </label>
        <select
          value={form.type}
          onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        >
          <option value="invited">Invitado</option>
          <option value="attendee">Asistente</option>
          <option value="copy">CC</option>
        </select>
      </div>

      <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 transition-theme">
        {form.participantId ? (
          <span>Catálogo maestro enlazado. {isLoadingCurrent ? 'Cargando correos...' : 'Puedes reutilizar o ampliar sus correos.'}</span>
        ) : (
          <span>Participante nuevo. Se registrará en el catálogo maestro al guardar.</span>
        )}
        {isSaving && <span className="ml-2">Guardando...</span>}
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────

const MinuteEditorSectionParticipants = ({ isReadOnly = false }) => {
  const { participants, addParticipant, updateParticipant, deleteParticipant } = useMinuteEditorStore();
  const [openEmailSelectorId, setOpenEmailSelectorId] = useState(null);

  const openForm = (existing = null) => {
    let submitForm = null;

    const modalId = ModalManager.custom({
      title:      existing ? 'Editar participante' : 'Agregar participante',
      size:       'medium',
      showFooter: true,
      content: (
        <ParticipantFormModal
          initialData={existing}
          registerSubmit={(submitter) => { submitForm = submitter; }}
          onSubmit={async (payload) => {
            if (existing) updateParticipant(existing.id, payload);
            else addParticipant(payload);
          }}
        />
      ),
      buttons: [
        {
          text:    'Guardar',
          variant: 'primary',
          onClick: async () => {
            const saved = await submitForm?.();
            if (saved) ModalManager.close(modalId);
          },
        },
      ],
    });
  };

  const handleDelete = (id, name) => {
    ModalManager.confirm({
      title:       'Eliminar participante',
      message:     `¿Eliminar a "${name}" de la lista de participantes?`,
      confirmText: 'Eliminar',
      onConfirm:   () => deleteParticipant(id),
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
            <Icon name="users" className="text-primary-600 dark:text-primary-400" />
            Participantes
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
            Tabla editable conectada al catálogo maestro de participantes y sus correos.
          </p>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => openForm()}
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-theme shadow-md text-sm font-medium"
          >
            <Icon name="userPlus" className="mr-2" />
            Agregar participante
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 transition-theme">
              <th className="pb-3 pr-4">Nombre</th>
              <th className="pb-3 pr-4">Email</th>
              <th className="pb-3 pr-4">Tipo</th>
              {!isReadOnly && <th className="pb-3">Acciones</th>}
            </tr>
          </thead>

          <tbody className="text-gray-900 dark:text-gray-100 transition-theme">
            {participants.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400 dark:text-gray-600 text-sm italic">
                  No hay participantes registrados.
                </td>
              </tr>
            ) : (
              participants.map(p => {
                const typeInfo = TYPE_LABELS[p.type] ?? TYPE_LABELS.invited;
                const emailOptions = getParticipantEmailOptions(p);
                const hasMultipleEmails = emailOptions.length > 1;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-theme"
                  >
                    {/* Nombre */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{p.fullName || p.name || '—'}</p>
                        {hasMultipleEmails && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300 transition-theme"
                            title="Este participante tiene más de un correo registrado. Revisa el correo seleccionado."
                          >
                            <Icon name="warning" className="text-[10px]" />
                            Varios mails
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3 pr-4">
                      {hasMultipleEmails ? (
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={() => setOpenEmailSelectorId((current) => current === p.id ? null : p.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-mono text-amber-800 shadow-sm transition-theme hover:border-amber-300 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-900/30"
                            title="Seleccionar correo"
                          >
                            <span>{p.email || 'Seleccionar correo'}</span>
                            <Icon name="chevronDown" className="text-[10px]" />
                          </button>

                          {openEmailSelectorId === p.id && (
                            <div className="absolute left-0 top-full z-20 mt-2 min-w-[280px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                              <div className="border-b border-gray-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:text-gray-400">
                                Correos disponibles
                              </div>
                              <div className="max-h-56 overflow-y-auto py-1">
                                {emailOptions.map((option) => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => {
                                      updateParticipant(p.id, { email: option.email });
                                      setOpenEmailSelectorId(null);
                                    }}
                                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-theme hover:bg-gray-50 dark:hover:bg-gray-800 ${
                                      emailsEqual(option.email, p.email)
                                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                                        : 'text-gray-700 dark:text-gray-200'
                                    }`}
                                  >
                                    <span className="font-mono">{option.email}</span>
                                    {option.isPrimary && (
                                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                                        Principal
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : p.email ? (
                        <span className="text-xs font-mono text-gray-600 dark:text-gray-400 transition-theme">{p.email}</span>
                      ) : (
                        <span className="text-xs italic text-gray-400 dark:text-gray-600 transition-theme">Sin correo</span>
                      )}
                    </td>

                    {/* Tipo */}
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border transition-theme ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </td>

                    {/* Acciones */}
                    {!isReadOnly && (
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openForm(p)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-theme"
                            title="Editar"
                          >
                            <Icon name="pen" className="text-xs" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id, p.fullName || p.name)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-theme"
                            title="Eliminar"
                          >
                            <Icon name="trash" className="text-xs" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default MinuteEditorSectionParticipants;
