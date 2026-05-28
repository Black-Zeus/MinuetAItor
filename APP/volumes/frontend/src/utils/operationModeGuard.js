import React from "react";

import ModalManager from "@/components/ui/modal";
import systemMaintenanceService from "@/services/systemMaintenanceService";

const MODE_LABELS = {
  maintenance: "mantenimiento",
  read_only: "solo lectura",
  commissioning: "puesta en marcha",
};

const MODE_TITLES = {
  maintenance: "Sistema en mantenimiento",
  read_only: "Sistema en solo lectura",
  commissioning: "Sistema en puesta en marcha",
};

const MODE_MESSAGES = {
  maintenance:
    "El sistema se encuentra temporalmente fuera de operación general. Solo administradores pueden ejecutar acciones de administración o recuperación.",
  read_only:
    "El sistema se encuentra habilitado solo para consulta. Esta acción modifica datos y permanecerá bloqueada hasta volver a modo operativo.",
  commissioning:
    "El sistema aún no se encuentra habilitado para operación productiva. Solo administradores pueden realizar configuraciones y transacciones de validación.",
};

const MODE_BADGE_CLASSES = {
  maintenance: "border-red-400/40 bg-red-500/10 text-red-100",
  read_only: "border-amber-300/40 bg-amber-500/10 text-amber-100",
  commissioning: "border-sky-300/40 bg-sky-500/10 text-sky-100",
};

const showOperationBlockedModal = ({ mode, reason, actionLabel } = {}) => {
  const label = MODE_LABELS[mode] || "operativo restringido";
  const reasonText = String(reason || "").trim();
  const actionText = String(actionLabel || "").trim();

  ModalManager.custom({
    title: MODE_TITLES[mode] || "Acción no disponible",
    size: "medium",
    showFooter: true,
    content: React.createElement(
      "div",
      { className: "space-y-3" },
      React.createElement(
        "div",
        {
          key: "state",
          className: "rounded-lg border border-slate-600/70 bg-slate-900/20 px-4 py-3",
        },
        React.createElement(
          "div",
          { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" },
          React.createElement("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-400" }, "Estado operativo"),
          React.createElement(
            "span",
            {
              className: `inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${MODE_BADGE_CLASSES[mode] || "border-slate-500/50 bg-slate-500/10 text-slate-100"}`,
            },
            label
          )
        ),
        React.createElement(
          "div",
          { className: "mt-3 border-t border-slate-700/70 pt-3" },
          React.createElement("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-400" }, "Motivo registrado"),
          React.createElement("p", { className: "mt-1 text-sm font-medium text-slate-100" }, reasonText || "Sin motivo informado.")
        )
      ),
      React.createElement(
        "div",
        { key: "warning", className: "rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" },
        React.createElement("p", { className: "text-xs font-semibold uppercase tracking-wide text-amber-200" }, "Advertencia"),
        React.createElement(
          "p",
          { className: "mt-1 font-medium leading-relaxed" },
          [
            actionText ? `No se puede ejecutar "${actionText}".` : null,
            MODE_MESSAGES[mode] || "Acción bloqueada temporalmente.",
          ].filter(Boolean).join(" ")
        )
      )
    ),
    buttons: [
      {
        text: "Cerrar",
        variant: "secondary",
        onClick: () => ModalManager.closeAll?.(),
      },
    ],
  });
};

export const ensureWriteOperationAllowed = async ({ actionLabel } = {}) => {
  try {
    const state = await systemMaintenanceService.getPublicOperationState();
    const mode = state?.mode || "normal";

    if (mode === "normal" || mode === "commissioning") return true;

    showOperationBlockedModal({
      mode,
      reason: state?.reason,
      actionLabel,
    });
    return false;
  } catch (_error) {
    return true;
  }
};

export default ensureWriteOperationAllowed;
