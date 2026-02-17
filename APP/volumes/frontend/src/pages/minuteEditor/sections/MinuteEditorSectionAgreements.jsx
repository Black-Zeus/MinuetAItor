/**
 * pages/minuteEditor/sections/MinuteEditorSectionAgreements.jsx
 * Tab "Acuerdos": tabla CRUD. Edición vía ModalManager.custom().
 *
 * Cambios solicitados:
 * - ModalManager.form() -> ModalManager.custom()
 * - Remueve columna "Estado" (y selector de estado en el modal). Todos quedan como "pending".
 * - Fecha compromiso: puede ser '-' (no definida) o formato 'YYYY-MM-DD' (sin hora).
 *   -> En UI se usa <input type="date"> y se guarda como 'YYYY-MM-DD' o '-' si vacío.
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';

const MinuteEditorSectionAgreements = () => {
    const { agreements, addAgreement, updateAgreement, deleteAgreement } = useMinuteEditorStore();

    // ---------------------------
    // Helpers (fecha)
    // ---------------------------
    const normalizeDueDate = (iso) => {
        const s = String(iso ?? '').trim();
        // input[type=date] entrega YYYY-MM-DD o vacío
        if (!s) return '-';
        // validación básica: YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '-';
        return s;
    };

    const toDateInputValue = (v) => {
        const s = String(v ?? '').trim();
        if (!s || s === '-') return '';
        // si ya viene en ISO, lo pasamos tal cual
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        return '';
    };

    const openForm = (existing = null) => {
        let draft = existing
            ? { ...existing }
            : { subject: '', body: '', responsible: '', dueDate: '-', status: 'pending' };

        // Forzamos estado a pending siempre (por requerimiento)
        draft.status = 'pending';

        let dueISO = toDateInputValue(draft.dueDate);

        const modalIdAcuerdo = ModalManager.custom({
            title: existing ? 'Editar acuerdo' : 'Agregar acuerdo',
            size: 'medium',
            showFooter: true,
            content: (
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
                            Asunto <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            defaultValue={draft.subject}
                            onChange={(e) => { draft.subject = e.target.value; }}
                            className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
                            Detalle
                        </label>
                        <textarea
                            defaultValue={draft.body}
                            onChange={(e) => { draft.body = e.target.value; }}
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
                                Responsable
                            </label>
                            <input
                                type="text"
                                defaultValue={draft.responsible}
                                onChange={(e) => { draft.responsible = e.target.value; }}
                                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
                                Fecha compromiso
                            </label>

                            {/* DatePicker: guarda YYYY-MM-DD o '-' */}
                            <input
                                type="date"
                                defaultValue={dueISO}
                                onChange={(e) => {
                                    dueISO = e.target.value; // YYYY-MM-DD o ''
                                    draft.dueDate = normalizeDueDate(dueISO);
                                }}
                                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-mono text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                            />

                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 transition-theme">
                                Opcional. Si no se define, se registrará como <span className="font-mono">-</span>.
                            </p>
                        </div>
                    </div>

                    {/* Estado removido: siempre pending */}
                </div>
            ),
            buttons: [
                {
                    text: 'Guardar',
                    variant: 'primary',
                    onClick: () => {
                        if (!draft.subject?.trim()) {
                            ModalManager.warning({ title: 'Campo requerido', message: 'El asunto es obligatorio.' });
                            return;
                        }

                        // Normaliza nuevamente por seguridad
                        draft.status = 'pending';
                        draft.dueDate = normalizeDueDate(toDateInputValue(draft.dueDate));

                        existing ? updateAgreement(existing.id, draft) : addAgreement(draft);

                        // Si tu ModalManager.custom no autocierra, cerrar aquí.
                        ModalManager.close(modalIdAcuerdo);
                    }
                }
            ]
        });
    };

    const handleDelete = (id, subject) => {
        ModalManager.confirm({
            title: 'Eliminar acuerdo',
            message: `¿Eliminar el acuerdo "${subject}"?`,
            confirmText: 'Eliminar',
            onConfirm: () => deleteAgreement(id),
        });
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
                        <Icon name="check" className="text-primary-600 dark:text-primary-400" />
                        Acuerdos
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
                    Agregar acuerdo
                </button>
            </div>

            <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 transition-theme">
                            <th className="pb-3 pr-4">ID</th>
                            <th className="pb-3 pr-4">Asunto</th>
                            <th className="pb-3 pr-4">Responsable</th>
                            <th className="pb-3 pr-4">Fecha</th>
                            <th className="pb-3">Acciones</th>
                        </tr>
                    </thead>

                    <tbody className="text-gray-900 dark:text-gray-100 transition-theme">
                        {agreements.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-8 text-center text-gray-400 dark:text-gray-600 text-sm italic">
                                    Sin acuerdos registrados.
                                </td>
                            </tr>
                        ) : agreements.map(a => (
                            <tr
                                key={a.id}
                                className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 align-top transition-theme"
                            >
                                {/* Mantengo tu ID visible actual (agreementId). */}
                                <td className="py-3 pr-4 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {a.agreementId}
                                </td>

                                <td className="py-3 pr-4 font-semibold max-w-xs">
                                    <span>{a.subject}</span>
                                    {a.body && (
                                        <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                            {a.body}
                                        </p>
                                    )}
                                </td>

                                <td className="py-3 pr-4 whitespace-nowrap">
                                    {a.responsible || '—'}
                                </td>

                                {/* Fecha: '-' o YYYY-MM-DD */}
                                <td className="py-3 pr-4 font-mono text-xs whitespace-nowrap">
                                    {a.dueDate && String(a.dueDate).trim() ? a.dueDate : '-'}
                                </td>

                                <td className="py-3">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openForm(a)}
                                            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-theme text-xs"
                                            title="Editar"
                                        >
                                            <Icon name="edit" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDelete(a.id, a.subject)}
                                            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-theme text-xs"
                                            title="Eliminar"
                                        >
                                            <Icon name="delete" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MinuteEditorSectionAgreements;