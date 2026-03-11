import React, { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import ModalManager from "@/components/ui/modal";

export const PARTICIPANTS_MODAL_MODES = {
  CREATE: "createParticipant",
  VIEW: "viewParticipant",
  EDIT: "editParticipant",
};

const normalizeEmails = (emails = []) => {
  const items = Array.isArray(emails) ? emails : [];
  if (items.length === 0) {
    return [{ id: null, email: "", isPrimary: true, isActive: true }];
  }

  return items.map((item, index) => ({
    id: item.id ?? null,
    email: item.email ?? "",
    isPrimary: Boolean(item.isPrimary ?? item.is_primary ?? index === 0),
    isActive: Boolean(item.isActive ?? item.is_active ?? true),
  }));
};

const normalizeParticipant = (data = {}) => ({
  displayName: data.displayName ?? data.display_name ?? "",
  organization: data.organization ?? "",
  title: data.title ?? "",
  notes: data.notes ?? "",
  isActive: data.isActive ?? data.is_active ?? true,
  emails: normalizeEmails(data.emails),
});

const inputCls = (hasError = false) =>
  `w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
    hasError ? "border-red-500" : "border-gray-200 dark:border-gray-700"
  }`;

const ParticipantsModal = ({ mode, data, onSubmit, onClose }) => {
  const isCreate = mode === PARTICIPANTS_MODAL_MODES.CREATE;
  const isView = mode === PARTICIPANTS_MODAL_MODES.VIEW;
  const isEdit = mode === PARTICIPANTS_MODAL_MODES.EDIT;

  const initialState = useMemo(() => normalizeParticipant(data), [data]);
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData(normalizeParticipant(data));
    setErrors({});
  }, [data]);

  const closeModal = () => {
    onClose?.();
    ModalManager.closeAll?.();
  };

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const setEmailField = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      emails: prev.emails.map((email, currentIndex) => {
        if (currentIndex !== index) return email;
        return { ...email, [field]: value };
      }),
    }));
    setErrors((prev) => ({ ...prev, emails: null }));
  };

  const addEmail = () => {
    setFormData((prev) => ({
      ...prev,
      emails: [...prev.emails, { id: null, email: "", isPrimary: prev.emails.length === 0, isActive: true }],
    }));
  };

  const removeEmail = (index) => {
    setFormData((prev) => {
      const next = prev.emails.filter((_, currentIndex) => currentIndex !== index);
      if (next.length > 0 && !next.some((item) => item.isPrimary && item.isActive)) {
        next[0] = { ...next[0], isPrimary: true, isActive: true };
      }
      return {
        ...prev,
        emails: next.length > 0 ? next : [{ id: null, email: "", isPrimary: true, isActive: true }],
      };
    });
  };

  const markPrimaryEmail = (index) => {
    setFormData((prev) => ({
      ...prev,
      emails: prev.emails.map((item, currentIndex) => ({
        ...item,
        isPrimary: currentIndex === index,
        isActive: currentIndex === index ? true : item.isActive,
      })),
    }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!String(formData.displayName ?? "").trim()) {
      nextErrors.displayName = "El nombre es obligatorio.";
    }

    const activeEmails = (formData.emails ?? [])
      .map((item) => ({
        ...item,
        email: String(item.email ?? "").trim().toLowerCase(),
      }))
      .filter((item) => item.email);

    const seen = new Set();
    for (const email of activeEmails) {
      if (seen.has(email.email)) {
        nextErrors.emails = "No puedes repetir correos.";
        break;
      }
      seen.add(email.email);
    }

    const activeWithFlag = activeEmails.filter((item) => item.isActive);
    const primaryActive = activeWithFlag.filter((item) => item.isPrimary);
    if (activeWithFlag.length > 0 && primaryActive.length !== 1) {
      nextErrors.emails = "Debes marcar un correo principal activo.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (isView) {
      closeModal();
      return;
    }
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit?.({
        ...formData,
        emails: (formData.emails ?? []).map((item) => ({
          ...item,
          email: String(item.email ?? "").trim().toLowerCase(),
        })),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-h-[80vh]">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Icon name="FaUsers" className="w-5 h-5" />
          {isCreate && "Crear participante"}
          {isEdit && "Editar participante"}
          {isView && "Detalle participante"}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            {isView ? (
              <p className="text-sm text-gray-700 dark:text-gray-300">{formData.displayName || "—"}</p>
            ) : (
              <>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setField("displayName", e.target.value)}
                  className={inputCls(Boolean(errors.displayName))}
                />
                {errors.displayName && <p className="mt-1 text-xs text-red-500">{errors.displayName}</p>}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organización</label>
            {isView ? (
              <p className="text-sm text-gray-700 dark:text-gray-300">{formData.organization || "—"}</p>
            ) : (
              <input
                type="text"
                value={formData.organization}
                onChange={(e) => setField("organization", e.target.value)}
                className={inputCls()}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cargo</label>
            {isView ? (
              <p className="text-sm text-gray-700 dark:text-gray-300">{formData.title || "—"}</p>
            ) : (
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setField("title", e.target.value)}
                className={inputCls()}
              />
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
            {isView ? (
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{formData.notes || "—"}</p>
            ) : (
              <textarea
                rows={4}
                value={formData.notes}
                onChange={(e) => setField("notes", e.target.value)}
                className={inputCls()}
              />
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Correos</h4>
            {!isView && (
              <ActionButton
                label="Agregar correo"
                size="sm"
                variant="soft"
                icon={<Icon name="FaPlus" />}
                onClick={addEmail}
              />
            )}
          </div>

          {errors.emails && <p className="text-xs text-red-500">{errors.emails}</p>}

          <div className="space-y-3">
            {(formData.emails ?? []).map((email, index) => (
              <div key={`${email.id ?? "new"}-${index}`} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                {isView ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">{email.email || "—"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {email.isPrimary ? "Principal" : "Secundario"} · {email.isActive ? "Activo" : "Inactivo"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
                    <input
                      type="email"
                      value={email.email}
                      onChange={(e) => setEmailField(index, "email", e.target.value)}
                      className={inputCls()}
                      placeholder="correo@empresa.com"
                    />
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        checked={Boolean(email.isPrimary)}
                        onChange={() => markPrimaryEmail(index)}
                      />
                      Principal
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={Boolean(email.isActive)}
                        onChange={(e) => setEmailField(index, "isActive", e.target.checked)}
                      />
                      Activo
                    </label>
                    <ActionButton
                      variant="soft"
                      size="xs"
                      icon={<Icon name="delete" />}
                      onClick={() => removeEmail(index)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
          {isView ? (
            <p className="text-sm text-gray-700 dark:text-gray-300">{formData.isActive ? "Activo" : "Inactivo"}</p>
          ) : (
            <select
              value={formData.isActive ? "active" : "inactive"}
              onChange={(e) => setField("isActive", e.target.value === "active")}
              className={inputCls()}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        <ActionButton label={isView ? "Cerrar" : "Cancelar"} variant="neutral" onClick={closeModal} />
        {!isView && (
          <ActionButton
            label={isSubmitting ? "Guardando..." : isCreate ? "Crear participante" : "Guardar cambios"}
            onClick={handleSubmit}
            disabled={isSubmitting}
          />
        )}
      </div>
    </div>
  );
};

export default ParticipantsModal;
