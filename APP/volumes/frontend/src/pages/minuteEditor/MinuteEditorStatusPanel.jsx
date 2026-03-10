/**
 * pages/minuteEditor/MinuteEditorStatusPanel.jsx
 *
 * Panel persistente en el footer del editor que muestra el estado actual
 * y los botones de transición disponibles. Cada transición abre un modal
 * de confirmación con campo de observación opcional.
 *
 * Transiciones válidas (según _VALID_TRANSITIONS del backend):
 *   ready-for-edit → pending | cancelled
 *   pending        → preview | cancelled
 *   preview        → pending | completed | cancelled
 *   cancelled      → (ninguna desde el editor)
 *   completed      → (terminal)
 *
 * TODO: reemplazar los console.log por llamadas reales a
 *       PUT /minutes/{id}/transition  { target_status, observation }
 */

import React, { useState } from 'react';
import Icon from '@components/ui/icon/iconManager';
import ModalManager from '@components/ui/modal';

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  'in-progress':      { label: 'En procesamiento',  color: 'blue'   },
  'ready-for-edit':   { label: 'Listo para editar', color: 'orange' },
  'pending':          { label: 'En edición',        color: 'yellow' },
  'preview':          { label: 'En revisión',       color: 'indigo' },
  'completed':        { label: 'Completado',        color: 'green'  },
  'cancelled':        { label: 'Cancelado',         color: 'gray'   },
  'llm-failed':       { label: 'Fallo IA',          color: 'red'    },
  'processing-error': { label: 'Error de proceso',  color: 'red'    },
};

const STATUS_BADGE_COLORS = {
  blue:   'bg-blue-50   dark:bg-blue-900/20   text-blue-700   dark:text-blue-300   border-blue-200/50   dark:border-blue-700/50',
  orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200/50 dark:border-orange-700/50',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200/50 dark:border-yellow-700/50',
  indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200/50 dark:border-indigo-700/50',
  green:  'bg-green-50  dark:bg-green-900/20  text-green-700  dark:text-green-300  border-green-200/50  dark:border-green-700/50',
  gray:   'bg-gray-100  dark:bg-gray-900      text-gray-600   dark:text-gray-400   border-gray-200/50   dark:border-gray-700/50',
  red:    'bg-red-50    dark:bg-red-900/20    text-red-700    dark:text-red-300    border-red-200/50    dark:border-red-700/50',
};

// Transiciones disponibles por estado
const TRANSITIONS = {
  'ready-for-edit': [
    { target: 'pending',   label: 'Iniciar edición',  icon: 'penToSquare', style: 'primary',  description: 'Mueve la minuta a edición y crea una copia de trabajo.' },
    { target: 'cancelled', label: 'Cancelar minuta',  icon: 'ban',         style: 'danger',   description: 'Anula la minuta. La acción es reversible solo por administrador.' },
  ],
  'pending': [
    { target: 'preview',   label: 'Enviar a revisión', icon: 'magnifyingGlass', style: 'primary',  description: 'Genera snapshot y encola PDF borrador con marca de agua.' },
    { target: 'cancelled', label: 'Cancelar minuta',   icon: 'ban',             style: 'danger',   description: 'Anula la minuta.' },
  ],
  'preview': [
    { target: 'completed', label: 'Aprobar y publicar', icon: 'circleCheck', style: 'success',  description: 'Marca la versión como final y encola PDF de publicación.' },
    { target: 'pending',   label: 'Devolver a edición', icon: 'rotate',      style: 'warning',  description: 'Devuelve la minuta a edición sin perder el borrador actual.' },
    { target: 'cancelled', label: 'Cancelar minuta',    icon: 'ban',         style: 'danger',   description: 'Anula la minuta.' },
  ],
};

const BTN_STYLES = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-md',
  success: 'bg-green-600 hover:bg-green-700 text-white shadow-md',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-md',
  danger:  'bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-700/50',
};

// ─────────────────────────────────────────────────────────────
// Modal de confirmación de transición
// ─────────────────────────────────────────────────────────────

const TransitionModalContent = ({ transition, currentStatus, onConfirm, onCancel }) => {
  const [observation, setObservation] = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const fromInfo = STATUS_LABELS[currentStatus]  ?? { label: currentStatus };
  const toInfo   = STATUS_LABELS[transition.target] ?? { label: transition.target };

  const handleConfirm = async () => {
    setSubmitting(true);
    await onConfirm(transition.target, observation.trim() || null);
    setSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-5">

      {/* Flecha de transición */}
      <div className="flex items-center justify-center gap-3 py-2">
        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border transition-theme ${STATUS_BADGE_COLORS[STATUS_LABELS[currentStatus]?.color ?? 'gray']}`}>
          {fromInfo.label}
        </span>
        <Icon name="arrowRight" className="text-gray-400 dark:text-gray-500" />
        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border transition-theme ${STATUS_BADGE_COLORS[STATUS_LABELS[transition.target]?.color ?? 'gray']}`}>
          {toInfo.label}
        </span>
      </div>

      {/* Descripción */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 transition-theme">
        <Icon name="circleInfo" className="text-primary-500 dark:text-primary-400 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700 dark:text-gray-300 transition-theme leading-relaxed">
          {transition.description}
        </p>
      </div>

      {/* Observación */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 transition-theme">
          Observación <span className="normal-case font-normal text-gray-400">(opcional)</span>
        </label>
        <textarea
          rows={3}
          value={observation}
          onChange={e => setObservation(e.target.value)}
          placeholder="Agrega una nota sobre este cambio de estado…"
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
        />
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 transition-theme">
          Quedará registrada en la línea de tiempo de la versión generada.
        </p>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-1 border-t border-gray-100 dark:border-gray-700/50 transition-theme">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-semibold transition-theme disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${BTN_STYLES[transition.style] ?? BTN_STYLES.primary}`}
        >
          {submitting
            ? <><i className="fas fa-spinner fa-spin text-sm" /> Procesando…</>
            : <><Icon name={transition.icon} /> {transition.label}</>
          }
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────

const MinuteEditorStatusPanel = ({ recordMeta, onTransitionSuccess }) => {
  const status      = recordMeta?.status;
  const transitions = TRANSITIONS[status] ?? [];
  const statusInfo  = STATUS_LABELS[status] ?? { label: status ?? '—', color: 'gray' };

  if (!status || transitions.length === 0) return null;

  const handleTransitionClick = (transition) => {
    ModalManager.custom({
      title:      transition.label,
      size:       'medium',
      showFooter: false,
      content: (
        <TransitionModalContent
          transition={transition}
          currentStatus={status}
          onCancel={() => ModalManager.close()}
          onConfirm={async (targetStatus, observation) => {
            ModalManager.close();
            // TODO: llamada real al backend
            // await transitionMinuteStatus(recordMeta.id, { target_status: targetStatus, observation });
            console.log('[StatusPanel] Transition:', { from: status, to: targetStatus, observation });
            onTransitionSuccess?.(targetStatus);
          }}
        />
      ),
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl px-5 py-4 border border-gray-200/50 dark:border-gray-700/50 shadow-md transition-theme">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">

        {/* Estado actual */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 transition-theme">
            <Icon name="arrowsRotate" className="text-gray-500 dark:text-gray-400 text-sm" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme">Estado actual</p>
            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border transition-theme ${STATUS_BADGE_COLORS[statusInfo.color]}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Separador */}
        <div className="hidden sm:block w-px h-10 bg-gray-200 dark:bg-gray-700 transition-theme shrink-0" />

        {/* Transiciones */}
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 transition-theme shrink-0 mr-1">
            Acciones:
          </p>
          {transitions.map(t => (
            <button
              key={t.target}
              type="button"
              onClick={() => handleTransitionClick(t)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${BTN_STYLES[t.style] ?? BTN_STYLES.primary}`}
            >
              <Icon name={t.icon} className="text-xs" />
              {t.label}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
};

export default MinuteEditorStatusPanel;