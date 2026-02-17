/**
 * pages/minuteEditor/sections/MinuteEditorSectionParticipants.jsx
 * Tab "Participantes": tabla CRUD completa.
 * Modal de formulario vía ModalManager.custom().
 * - Ajuste: se eliminan columnas Rol y Correo
 * - Modal: solo Nombre + Tipo
 */

import React from "react";
import Icon from "@components/ui/icon/iconManager";
import ModalManager from "@components/ui/modal";
import useMinuteEditorStore from "@/store/minuteEditorStore";

// Badges de tipo
const TYPE_CLASSES = {
    invited:
        "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-700/50",
    attendee:
        "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/50 dark:border-green-700/50",
    copy:
        "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-amber-200/50 dark:border-amber-700/50",
};

const TYPE_LABELS = { invited: "Invitado", attendee: "Asistente", copy: "CC" };

const TypeBadge = ({ type }) => (
    <span
        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border transition-theme ${TYPE_CLASSES[type] ??
            "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            }`}
    >
        {TYPE_LABELS[type] ?? type}
    </span>
);

// Formulario reutilizable (dentro del modal) - SOLO Nombre + Tipo
const ParticipantFormFields = ({ data, onChange }) => (
    <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
                Nombre completo *
            </label>
            <input
                type="text"
                value={data.fullName ?? ""}
                onChange={(e) => onChange("fullName", e.target.value)}
                placeholder="Ej: Paula Rojas"
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                autoFocus
            />
        </div>

        <div className="col-span-12">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
                Tipo
            </label>
            <select
                value={data.type ?? "invited"}
                onChange={(e) => onChange("type", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            >
                <option value="invited">Invitado</option>
                <option value="attendee">Asistente</option>
                <option value="copy">CC</option>
            </select>

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 transition-theme">
                “Tipo” define en qué sección se clasificará (Invitado / Asistente / CC).
            </p>
        </div>
    </div>
);

const MinuteEditorSectionParticipants = () => {
    const { participants, addParticipant, updateParticipant, deleteParticipant } =
        useMinuteEditorStore();

    const openForm = (existing = null) => {
        // Draft mutable (suficiente para guardar al confirmar)
        let draft = existing
            ? { ...existing }
            : { fullName: "", type: "invited" };

        const handleSave = () => {
            if (!draft.fullName?.trim()) {
                ModalManager.warning({
                    title: "Campo requerido",
                    message: "El nombre completo es obligatorio.",
                });
                return; // NO cerrar
            }

            if (existing) updateParticipant(existing.id, draft);
            else addParticipant(draft);

            // Cerrar modal (si tu ModalManager expone método explícito)
            ModalManager.hide?.();
        };

        const modalId = ModalManager.custom({
            title: existing ? "Editar participante" : "Agregar participante",
            size: "medium",
            showFooter: true,
            content: (
                <div className="p-6">
                    <ParticipantFormFields
                        data={draft}
                        onChange={(key, val) => setDraft(prev => ({ ...prev, [key]: val }))}
                    />
                </div>
            ),
            buttons: [                
                { text: "Guardar", variant: "primary", onClick: () => { handleSave(draft); ModalManager.close(modalId); } }
            ]
        });
    };

    const handleDelete = (id, name) => {
        ModalManager.confirm({
            title: "Eliminar participante",
            message: `¿Eliminar a "${name}" de la lista de participantes?`,
            confirmText: "Eliminar",
            onConfirm: () => deleteParticipant(id),
        });
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
                        <Icon
                            name="users"
                            className="text-primary-600 dark:text-primary-400"
                        />
                        Participantes
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
                        Tabla editable con acciones: crear, editar y eliminar registros.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => openForm()}
                    className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-theme shadow-md text-sm font-medium"
                >
                    <Icon name="userPlus" className="mr-2" />
                    Agregar participante
                </button>
            </div>

            <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 transition-theme">
                            <th className="pb-3 pr-4">Nombre</th>
                            <th className="pb-3 pr-4">Tipo</th>
                            <th className="pb-3">Acciones</th>
                        </tr>
                    </thead>

                    <tbody className="text-gray-900 dark:text-gray-100 transition-theme">
                        {participants.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={3}
                                    className="py-8 text-center text-gray-400 dark:text-gray-600 text-sm italic"
                                >
                                    No hay participantes registrados.
                                </td>
                            </tr>
                        ) : (
                            participants.map((p) => (
                                <tr
                                    key={p.id}
                                    className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 transition-theme"
                                >
                                    <td className="py-3 pr-4 font-semibold">{p.fullName}</td>
                                    <td className="py-3 pr-4">
                                        <TypeBadge type={p.type} />
                                    </td>
                                    <td className="py-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openForm(p)}
                                                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-theme text-xs"
                                                title="Editar"
                                            >
                                                <Icon name="edit" />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleDelete(p.id, p.fullName)}
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

            <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme mt-4 border-t border-gray-100 dark:border-gray-700/50 pt-4">
                * “Tipo” define en qué sección aparece (Invitado / Asistente / CC).
            </p>
        </div>
    );
};

export default MinuteEditorSectionParticipants;