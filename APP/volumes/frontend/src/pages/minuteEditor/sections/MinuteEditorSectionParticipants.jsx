/**
 * pages/minuteEditor/sections/MinuteEditorSectionParticipants.jsx
 * Tab "Participantes": tabla editable con modal para crear/editar.
 *
 * Cambios:
 * - Formulario incluye campo "Email" (mockup — campo almacenado en store, sin lógica de BD aún).
 * - Tabla muestra columna Email.
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';
import useMinuteEditorStore from '@/store/minuteEditorStore';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS = {
  invited:  { label: 'Invitado',   color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-700/50' },
  attendee: { label: 'Asistente',  color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/50 dark:border-green-700/50' },
  copy:     { label: 'CC',         color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200/50 dark:border-purple-700/50' },
};

// ── Formulario de participante ────────────────────────────────────────────────

const ParticipantFormFields = ({ data, onChange }) => (
  <div className="space-y-4">

    {/* Nombre */}
    <div>
      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider transition-theme">
        Nombre completo <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={data.fullName ?? ''}
        onChange={e => onChange('fullName', e.target.value)}
        placeholder="Ej: Juan Pérez"
        className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
      />
    </div>

    {/* Email — mockup, sin lógica de BD aún */}
    <div>
      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider transition-theme">
        Correo electrónico
        <span className="ml-2 normal-case text-gray-400 dark:text-gray-500 font-normal">(mockup)</span>
      </label>
      <input
        type="email"
        value={data.email ?? ''}
        onChange={e => onChange('email', e.target.value)}
        placeholder="correo@empresa.com"
        className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
      />
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-theme">
        Se usará para el envío de la minuta. La lógica de BD se habilitará próximamente.
      </p>
    </div>

    {/* Tipo */}
    <div>
      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider transition-theme">
        Tipo de participación <span className="text-red-500">*</span>
      </label>
      <select
        value={data.type ?? 'invited'}
        onChange={e => onChange('type', e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
      >
        <option value="invited">Invitado</option>
        <option value="attendee">Asistente</option>
        <option value="copy">CC</option>
      </select>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 transition-theme">
        Define en qué sección se clasificará: Invitado / Asistente / CC.
      </p>
    </div>

  </div>
);

// ── Componente principal ──────────────────────────────────────────────────────

const MinuteEditorSectionParticipants = ({ isReadOnly = false }) => {
  const { participants, addParticipant, updateParticipant, deleteParticipant } = useMinuteEditorStore();

  const openForm = (existing = null) => {
    let draft = existing
      ? { ...existing }
      : { fullName: '', email: '', type: 'invited' };

    const handleSave = (modalId) => {
      if (!draft.fullName?.trim()) {
        ModalManager.warning({
          title:   'Campo requerido',
          message: 'El nombre completo es obligatorio.',
        });
        return;
      }
      if (existing) updateParticipant(existing.id, draft);
      else          addParticipant(draft);
      ModalManager.close(modalId);
    };

    const modalId = ModalManager.custom({
      title:      existing ? 'Editar participante' : 'Agregar participante',
      size:       'medium',
      showFooter: true,
      content: (
        <div className="p-6">
          <ParticipantFormFields
            data={draft}
            onChange={(key, val) => { draft = { ...draft, [key]: val }; }}
          />
        </div>
      ),
      buttons: [
        {
          text:    'Guardar',
          variant: 'primary',
          onClick: () => handleSave(modalId),
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
            Tabla editable. El campo correo es mockup — la lógica de BD se habilitará próximamente.
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
                return (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-theme"
                  >
                    {/* Nombre */}
                    <td className="py-3 pr-4">
                      <p className="font-semibold">{p.fullName || p.name || '—'}</p>
                    </td>

                    {/* Email */}
                    <td className="py-3 pr-4">
                      {p.email ? (
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