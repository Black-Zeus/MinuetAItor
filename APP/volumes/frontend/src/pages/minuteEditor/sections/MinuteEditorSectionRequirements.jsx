/**
 * pages/minuteEditor/sections/MinuteEditorSectionRequirements.jsx
 * Tab "Requerimientos": tabla CRUD. Edición vía ModalManager.custom().
 *
 * Ajuste solicitado:
 * - Reordena campos del modal en este orden:
 *   1) Requerimiento
 *   2) Entidad
 *   3) Responsable
 *   4) Prioridad
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';

const PRIO_CLASSES = {
  high:   'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200/50',
  medium: 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-amber-200/50',
  low:    'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/50',
};
const PRIO_LABELS = { high: 'Alta', medium: 'Media', low: 'Baja' };

const PrioBadge = ({ prio }) => (
  <span
    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border transition-theme ${
      PRIO_CLASSES[prio] ?? PRIO_CLASSES.medium
    }`}
  >
    {PRIO_LABELS[prio] ?? prio}
  </span>
);

const MinuteEditorSectionRequirements = () => {
  const { requirements, addRequirement, updateRequirement, deleteRequirement } = useMinuteEditorStore();

  const openForm = (existing = null) => {
    let draft = existing
      ? { ...existing }
      : { entity: '', body: '', responsible: '', priority: 'medium', status: 'open' };

    // Estado oculto; se preserva por compatibilidad
    draft.status = draft.status || 'open';

    const modalIdRequerimiento=ModalManager.custom({
      title: existing ? 'Editar requerimiento' : 'Agregar requerimiento',
      size: 'medium',
      showFooter: true,
      content: (
        <div className="p-6 space-y-4">
          {/* 1) Requerimiento */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
              Requerimiento <span className="text-red-500">*</span>
            </label>
            <textarea
              defaultValue={draft.body}
              onChange={(e) => { draft.body = e.target.value; }}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
            />
          </div>

          {/* 2) Entidad */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
              Entidad
            </label>
            <input
              type="text"
              defaultValue={draft.entity}
              onChange={(e) => { draft.entity = e.target.value; }}
              placeholder="Ej: Cliente S.A. (TI)"
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          {/* 3) Responsable */}
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

          {/* 4) Prioridad */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 transition-theme">
              Prioridad
            </label>
            <select
              defaultValue={draft.priority}
              onChange={(e) => { draft.priority = e.target.value; }}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            >
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>
        </div>
      ),
      buttons: [
        {
          text: 'Guardar',
          variant: 'primary',
          onClick: () => {
            if (!draft.body?.trim()) {
              ModalManager.warning({
                title: 'Campo requerido',
                message: 'El requerimiento no puede estar vacío.',
              });
              return;
            }

            draft.status = draft.status || 'open';
            existing ? updateRequirement(existing.id, draft) : addRequirement(draft);

            // Si tu ModalManager.custom no autocierra, cerrar aquí.
            ModalManager.close(modalIdRequerimiento);
          },
        },
      ],
    });
  };

  const handleDelete = (id, body) => {
    ModalManager.confirm({
      title: 'Eliminar requerimiento',
      message: `¿Eliminar el requerimiento "${String(body ?? '').slice(0, 60)}…"?`,
      confirmText: 'Eliminar',
      onConfirm: () => deleteRequirement(id),
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
            <Icon name="thumbtack" className="text-primary-600 dark:text-primary-400" />
            Requerimientos
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
          Agregar requerimiento
        </button>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 transition-theme">
              <th className="pb-3 pr-4">ID</th>
              <th className="pb-3 pr-4">Requerimiento</th>
              <th className="pb-3 pr-4">Entidad</th>
              <th className="pb-3 pr-4">Responsable</th>
              <th className="pb-3 pr-4">Prioridad</th>
              <th className="pb-3">Acciones</th>
            </tr>
          </thead>

          <tbody className="text-gray-900 dark:text-gray-100 transition-theme">
            {requirements.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 dark:text-gray-600 text-sm italic">
                  Sin requerimientos registrados.
                </td>
              </tr>
            ) : (
              requirements.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 align-top transition-theme"
                >
                  <td className="py-3 pr-4 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {r.requirementId}
                  </td>

                  <td className="py-3 pr-4 font-semibold max-w-xs">
                    <span className="line-clamp-2">{r.body}</span>
                  </td>

                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {r.entity || '—'}
                  </td>

                  <td className="py-3 pr-4 whitespace-nowrap">
                    {r.responsible || '—'}
                  </td>

                  <td className="py-3 pr-4">
                    <PrioBadge prio={r.priority} />
                  </td>

                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openForm(r)}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-theme text-xs"
                        title="Editar"
                      >
                        <Icon name="edit" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(r.id, r.body)}
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
    </div>
  );
};

export default MinuteEditorSectionRequirements;