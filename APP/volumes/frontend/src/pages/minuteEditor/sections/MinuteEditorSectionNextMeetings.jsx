/**
 * pages/minuteEditor/sections/MinuteEditorSectionNextMeetings.jsx
 * Tab "Próximas Reuniones": tabla CRUD. Edición vía ModalManager.custom().
 *
 * Ajuste adicional:
 * - Se agrega aviso visible al final de la sección (debajo de la tabla) indicando que la fecha es obligatoria.
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';

const MinuteEditorSectionNextMeetings = () => {
    const {
        upcomingMeetings,
        addUpcomingMeeting,
        updateUpcomingMeeting,
        deleteUpcomingMeeting,
    } = useMinuteEditorStore();

    // ---------------------------
    // Helpers (fecha)
    // ---------------------------
    const isPorDefinir = (v) => {
        const s = String(v ?? '').trim().toLowerCase();
        return !s || s === 'por definir';
    };

    // dd/mm/aaaa -> yyyy-mm-dd (para <input type="date">)
    const ddmmyyyyToISO = (v) => {
        const s = String(v ?? '').trim();
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!m) return '';
        const [, dd, mm, yyyy] = m;
        return `${yyyy}-${mm}-${dd}`;
    };

    // yyyy-mm-dd -> dd/mm/aaaa (para mantener tu formato de tabla)
    const isoToDDMMYYYY = (v) => {
        const s = String(v ?? '').trim();
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return '';
        const [, yyyy, mm, dd] = m;
        return `${dd}/${mm}/${yyyy}`;
    };

    const openForm = (existing = null) => {
        let draft = existing
            ? { ...existing }
            : { scheduledDate: 'Por definir', agenda: '', attendees: [] };

        let scheduledISO = isPorDefinir(draft.scheduledDate)
            ? ''
            : ddmmyyyyToISO(draft.scheduledDate);

        const modalIdReunion = ModalManager.custom({
            title: existing ? 'Editar próxima reunión' : 'Agregar próxima reunión',
            size: 'medium',
            showFooter: true,
            content: (
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
                            Fecha programada <span className="text-red-500">*</span>
                        </label>

                        <input
                            type="date"
                            defaultValue={scheduledISO}
                            onChange={(e) => {
                                scheduledISO = e.target.value;
                                draft.scheduledDate = scheduledISO
                                    ? isoToDDMMYYYY(scheduledISO)
                                    : 'Por definir';
                            }}
                            className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-mono text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                        />

                        {/* Aviso en el modal */}
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300 transition-theme">
                            La fecha es obligatoria. Si aparece “Por definir”, debes seleccionarla para poder guardar.
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
                        if (isPorDefinir(draft.scheduledDate)) {
                            ModalManager.warning({
                                title: 'Campo requerido',
                                message: 'Debes seleccionar una fecha programada para guardar.',
                            });
                            return;
                        }

                        if (!draft.agenda?.trim()) {
                            ModalManager.warning({
                                title: 'Campo requerido',
                                message: 'La agenda no puede estar vacía.',
                            });
                            return;
                        }

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

                <button
                    type="button"
                    onClick={() => openForm()}
                    className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-theme shadow-md text-sm font-medium"
                >
                    <Icon name="plus" className="mr-2" />
                    Agregar reunión
                </button>
            </div>

            <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 transition-theme">
                            <th className="pb-3 pr-4">ID</th>
                            <th className="pb-3 pr-4">Fecha</th>
                            <th className="pb-3 pr-4">Agenda</th>
                            <th className="pb-3">Acciones</th>
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
                                    className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 align-top transition-theme"
                                >
                                    <td className="py-3 pr-4 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {m.meetingId}
                                    </td>

                                    <td className="py-3 pr-4 font-mono text-xs whitespace-nowrap">
                                        {m.scheduledDate}
                                    </td>

                                    <td className="py-3 pr-4 max-w-xs">
                                        <span className="line-clamp-2">{m.agenda}</span>
                                    </td>

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
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Aviso en la sección (al final, debajo de la tabla) */}
            <div className="mt-4 rounded-xl border border-amber-200/70 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 transition-theme">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                        <Icon name="circleInfo" className="text-amber-600 dark:text-amber-300" />
                    </div>
                    <div className="text-sm">
                        <p className="text-amber-900 dark:text-amber-100 font-semibold transition-theme">
                            Requisito de fecha
                        </p>
                        <p className="text-amber-800 dark:text-amber-200 transition-theme">
                            La <span className="font-semibold">fecha programada es obligatoria</span>. Si ves “Por definir”, edita el registro y selecciona una fecha antes de guardar.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MinuteEditorSectionNextMeetings;