/**
 * pages/minuteEditor/sections/MinuteEditorSectionNextMeetings.jsx
 * Tab "Próximas Reuniones": tabla CRUD. Edición vía ModalManager.custom().
 *
 * Ajuste adicional:
 * - La fecha puede quedar como "Por definir" cuando no se conoce aun.
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';

const MinuteEditorSectionNextMeetings = ({ isReadOnly = false }) => {
    const {
        upcomingMeetings,
        addUpcomingMeeting,
        updateUpcomingMeeting,
        deleteUpcomingMeeting,
        activeSearchTargetId,
    } = useMinuteEditorStore();

    // ---------------------------
    // Helpers (fecha)
    // ---------------------------
    const isPorDefinir = (v) => {
        const s = String(v ?? '').trim().toLowerCase();
        return !s || s === '-' || s === '—' || s === 'por definir';
    };

    // Normaliza valores legacy/IA para <input type="date">.
    const toDateInputValue = (v) => {
        const s = String(v ?? '').trim();
        if (isPorDefinir(s)) return '';

        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) return s;

        const ddmmyyyy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!ddmmyyyy) return '';
        const [, dd, mm, yyyy] = ddmmyyyy;
        return `${yyyy}-${mm}-${dd}`;
    };

    const normalizeScheduledDate = (v) => {
        const s = String(v ?? '').trim();
        if (isPorDefinir(s)) return 'Por definir';
        return toDateInputValue(s) || s;
    };

    const displayScheduledDate = (v) => {
        const s = String(v ?? '').trim();
        return isPorDefinir(s) ? 'Por definir' : s;
    };

    const openForm = (existing = null) => {
        let draft = existing
            ? { ...existing }
            : { scheduledDate: 'Por definir', agenda: '', attendees: [] };

        let scheduledISO = toDateInputValue(draft.scheduledDate);
        let useUndefinedDate = isPorDefinir(draft.scheduledDate);
        draft.scheduledDate = normalizeScheduledDate(draft.scheduledDate);
        const dateInputRef = React.createRef();

        const modalIdReunion = ModalManager.custom({
            title: existing ? 'Editar próxima reunión' : 'Agregar próxima reunión',
            size: 'medium',
            showFooter: true,
            content: (
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
                            Fecha programada
                        </label>

                        <input
                            ref={dateInputRef}
                            type="date"
                            defaultValue={scheduledISO}
                            disabled={useUndefinedDate}
                            onChange={(e) => {
                                scheduledISO = e.target.value;
                                draft.scheduledDate = normalizeScheduledDate(scheduledISO);
                            }}
                            className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-mono text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                        />

                        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 transition-theme">
                            <input
                                type="checkbox"
                                defaultChecked={useUndefinedDate}
                                onChange={(e) => {
                                    useUndefinedDate = e.target.checked;

                                    if (dateInputRef.current) {
                                        dateInputRef.current.disabled = useUndefinedDate;
                                        if (useUndefinedDate) {
                                            dateInputRef.current.value = '';
                                        }
                                    }

                                    scheduledISO = useUndefinedDate
                                        ? ''
                                        : (dateInputRef.current?.value ?? '');
                                    draft.scheduledDate = useUndefinedDate
                                        ? 'Por definir'
                                        : normalizeScheduledDate(scheduledISO);
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900"
                            />
                            <span>Marcar como Por definir</span>
                        </label>

                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 transition-theme">
                            Puedes indicar una fecha concreta o dejarla como “Por definir”.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
                            Agenda / Objetivo <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            defaultValue={draft.agenda}
                            onChange={(e) => {
                                draft.agenda = e.target.value;
                            }}
                            rows={4}
                            className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
                        />
                    </div>
                </div>
            ),
            buttons: [
                {
                    text: 'Guardar',
                    variant: 'primary',
                    onClick: () => {
                        if (!draft.agenda?.trim()) {
                            ModalManager.warning({
                                title: 'Campo requerido',
                                message: 'La agenda no puede estar vacía.',
                            });
                            return;
                        }

                        draft.scheduledDate = useUndefinedDate
                            ? 'Por definir'
                            : normalizeScheduledDate(scheduledISO || dateInputRef.current?.value);

                        existing
                            ? updateUpcomingMeeting(existing.id, draft)
                            : addUpcomingMeeting(draft);

                        // Si tu ModalManager.custom no autocierra, cerrar aquí.
                        ModalManager.close(modalIdReunion);
                    },
                },
            ],
        });
    };

    const handleDelete = (id, agenda) => {
        ModalManager.confirm({
            title: 'Eliminar próxima reunión',
            message: `¿Eliminar la reunión "${String(agenda ?? '').slice(0, 60)}…"?`,
            confirmText: 'Eliminar',
            onConfirm: () => deleteUpcomingMeeting(id),
        });
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
                        <Icon name="calendar" className="text-primary-600 dark:text-primary-400" />
                        Próximas reuniones
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
                        Editable. Incluye acciones editar / eliminar.
                    </p>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => openForm()}
                    className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-theme shadow-md text-sm font-medium"
                  >
                    <Icon name="plus" className="mr-2" />
                    Agregar reunión
                  </button>
                )}
            </div>

            <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 transition-theme">
                            <th className="pb-3 pr-4">ID</th>
                            <th className="pb-3 pr-4">Fecha</th>
                            <th className="pb-3 pr-4">Agenda</th>
                            {!isReadOnly && <th className="pb-3">Acciones</th>}
                        </tr>
                    </thead>

                    <tbody className="text-gray-900 dark:text-gray-100 transition-theme">
                        {upcomingMeetings.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-gray-400 dark:text-gray-600 text-sm italic">
                                    Sin reuniones programadas.
                                </td>
                            </tr>
                        ) : (
                            upcomingMeetings.map((m) => (
                                <tr
                                    key={m.id}
                                    data-search-target={`next-meeting-${m.id}`}
                                    className={`border-b border-gray-100 dark:border-gray-700/50 last:border-0 align-top transition-theme ${
                                      activeSearchTargetId === `next-meeting-${m.id}` ? "bg-primary-50/70 dark:bg-primary-900/15" : ""
                                    }`}
                                >
                                    <td className="py-3 pr-4 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {m.meetingId}
                                    </td>

                                    <td className="py-3 pr-4 font-mono text-xs whitespace-nowrap">
                                        {displayScheduledDate(m.scheduledDate)}
                                    </td>

                                    <td className="py-3 pr-4 max-w-xs">
                                        <span className="line-clamp-2">{m.agenda}</span>
                                    </td>

                                    {!isReadOnly && (
                                      <td className="py-3">
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => openForm(m)}
                                            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-theme text-xs"
                                            title="Editar"
                                          >
                                            <Icon name="edit" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDelete(m.id, m.agenda)}
                                            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-theme text-xs"
                                            title="Eliminar"
                                          >
                                            <Icon name="delete" />
                                          </button>
                                        </div>
                                      </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 rounded-xl border border-primary-200/70 dark:border-primary-400/20 bg-primary-50 dark:bg-primary-900/10 px-4 py-3 transition-theme">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                        <Icon name="circleInfo" className="text-primary-600 dark:text-primary-300" />
                    </div>
                    <div className="text-sm">
                        <p className="text-primary-900 dark:text-primary-100 font-semibold transition-theme">
                            Fecha opcional
                        </p>
                        <p className="text-primary-800 dark:text-primary-200 transition-theme">
                            Cuando la fecha aún no exista, la reunión se mostrará como <span className="font-semibold">Por definir</span>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MinuteEditorSectionNextMeetings;
