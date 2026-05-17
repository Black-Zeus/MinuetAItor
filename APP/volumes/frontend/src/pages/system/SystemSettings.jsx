import React, { useEffect, useMemo, useRef, useState } from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import SmtpConfigModal, {
  SMTP_MODAL_MODES,
  SMTP_TEST_IDLE_MESSAGE,
  SmtpTestDialogPanel,
} from "@/pages/system/SmtpConfigModal";
import smtpConfigService from "@/services/smtpConfigService";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY = "text-gray-600 dark:text-gray-300";
const TXT_META = "text-gray-500 dark:text-gray-400";

const TABS = [
  {
    id: "summary",
    label: "Resumen",
    icon: "FaGaugeHigh",
    description: "Vista general del módulo",
  },
  {
    id: "integrations",
    label: "Integraciones",
    icon: "FaCloud",
    description: "SMTP e inteligencia artificial",
  },
  {
    id: "maintenance",
    label: "Mantenimiento",
    icon: "FaGears",
    description: "Próxima etapa",
  },
  {
    id: "backups",
    label: "Respaldos",
    icon: "FaDatabase",
    description: "Próxima etapa",
  },
];

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const statusClasses = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  info: "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300",
};

const Header = () => (
  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <h1 className={`flex items-center gap-3 text-3xl font-bold ${TXT_TITLE}`}>
        <Icon name="FaGears" className="h-8 w-8 text-primary-600 dark:text-primary-400" />
        Sistema
      </h1>
      <p className={`mt-2 max-w-3xl text-sm ${TXT_BODY}`}>
        Administra integraciones globales con configuraciones persistidas, activación controlada y validación previa al guardado.
      </p>
    </div>

    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Foco actual</p>
      <p className={`mt-1 text-sm font-medium ${TXT_TITLE}`}>SMTP administrable con prueba obligatoria</p>
    </div>
  </div>
);

const TabNav = ({ activeTab, onTabChange }) => (
  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className="grid grid-cols-1 md:grid-cols-4">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={[
              "border-b border-r border-gray-200 px-5 py-4 text-left transition-colors last:border-r-0 md:last:border-r-0 dark:border-gray-700",
              isActive
                ? "bg-primary-50 dark:bg-primary-900/20"
                : "bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700/40",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2 ${isActive ? statusClasses.info : statusClasses.inactive}`}>
                <Icon name={tab.icon} className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${TXT_TITLE}`}>{tab.label}</p>
                <p className={`mt-1 text-xs ${TXT_META}`}>{tab.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const SectionCard = ({ title, icon, description, actions = null, children }) => (
  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-700 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className={`flex items-center gap-3 text-lg font-semibold ${TXT_TITLE}`}>
          <Icon name={icon} className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          {title}
        </h2>
        {description ? <p className={`mt-2 text-sm ${TXT_BODY}`}>{description}</p> : null}
      </div>
      {actions}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const StatusBadge = ({ tone, children }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[tone] ?? statusClasses.inactive}`}>
    {children}
  </span>
);

const SendSmtpTestModal = ({ config, onClose, onSent }) => {
  const [email, setEmail] = useState(String(config?.fromEmail || "").trim());
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState(SMTP_TEST_IDLE_MESSAGE);

  const handleSend = async () => {
    if (!String(email || "").trim()) {
      setStatus("error");
      setMessage("Indica un correo destino para enviar la prueba.");
      toastError("Correo requerido", "Indica un correo destino para enviar la prueba.");
      return;
    }

    setIsSending(true);
    setStatus("loading");
    setMessage("Probando conexión, autenticación y entrega del correo HTML...");
    try {
      await smtpConfigService.test({
        config_id: config.id,
        test_email: String(email).trim(),
      });
      const successMessage = `Se envió una prueba a ${String(email).trim()}.`;
      setStatus("success");
      setMessage(successMessage);
      toastSuccess("Prueba SMTP enviada", successMessage);
      onSent?.();
    } catch (error) {
      const errorMessage = error?.message ?? "La prueba SMTP no pudo completarse.";
      setStatus("error");
      setMessage(errorMessage);
      toastError("No se pudo enviar la prueba", errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex w-full justify-center px-4">
      <SmtpTestDialogPanel
        email={email}
        onEmailChange={setEmail}
        onClose={onClose}
        onRunTest={handleSend}
        isTesting={isSending}
        status={status}
        message={message}
        title="Enviar prueba SMTP"
        description={`Envía una prueba rápida usando ${config?.name}.`}
        submitLabel="Enviar prueba"
        submittingLabel="Validando SMTP..."
      />
    </div>
  );
};

const PlaceholderPanel = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <Icon name="FaGears" className="mx-auto h-8 w-8 text-primary-500 dark:text-primary-400" />
    <h2 className={`mt-4 text-lg font-semibold ${TXT_TITLE}`}>{title}</h2>
    <p className={`mx-auto mt-2 max-w-2xl text-sm ${TXT_BODY}`}>{description}</p>
  </div>
);

const SummaryPanel = ({ smtpItems }) => {
  const activeCount = smtpItems.filter((item) => item.isActive).length;
  const inactiveCount = smtpItems.length - activeCount;

  const cards = [
    { label: "Configuraciones SMTP", value: smtpItems.length, icon: "FaEnvelope", tone: "info" },
    { label: "Activas", value: activeCount, icon: "FaCheckCircle", tone: "active" },
    { label: "Inactivas", value: inactiveCount, icon: "FaPauseCircle", tone: "inactive" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${TXT_META}`}>{card.label}</p>
              <p className={`mt-2 text-3xl font-bold ${TXT_TITLE}`}>{card.value}</p>
            </div>
            <div className={`rounded-2xl p-3 ${statusClasses[card.tone]}`}>
              <Icon name={card.icon} className="h-5 w-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const SmtpTable = ({ items, isLoading, onEdit, onActivate, onSend, onDelete }) => {
  if (isLoading) {
    return <p className={`text-sm ${TXT_BODY}`}>Cargando configuraciones SMTP...</p>;
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-700">
        <p className={`text-sm ${TXT_BODY}`}>No hay configuraciones SMTP registradas.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Nombre</th>
            <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Estado</th>
            <th className={`py-3 pr-4 text-left font-semibold ${TXT_META}`}>Host</th>
            <th className={`py-3 text-right font-semibold ${TXT_META}`}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={[
                "border-b border-gray-100 align-top dark:border-gray-700/60",
                item.isActive ? "bg-green-50/60 dark:bg-green-950/10" : "",
              ].join(" ")}
            >
              <td className="py-4 pr-4">
                <p className={`font-semibold ${TXT_TITLE}`}>{item.name}</p>
                <p className={`mt-1 text-xs ${TXT_META}`}>{item.fromEmail}</p>
              </td>
              <td className="py-4 pr-4">
                <StatusBadge tone={item.isActive ? "active" : "inactive"}>
                  {item.isActive ? "Activa" : "Inactiva"}
                </StatusBadge>
              </td>
              <td className="py-4 pr-4">
                <p className={`font-medium ${TXT_TITLE}`}>{item.host}</p>
                <p className={`mt-1 text-xs ${TXT_META}`}>Puerto {item.port}</p>
              </td>
              <td className="py-4 text-right">
                <div className="ml-auto grid w-[224px] grid-cols-4 gap-2">
                  <ActionButton
                    variant="soft"
                    size="xs"
                    icon={<Icon name="paperPlane" />}
                    tooltip="Enviar prueba SMTP"
                    onClick={() => onSend(item)}
                    className="w-full hover:scale-100 active:scale-100"
                  />
                  <ActionButton
                    variant="soft"
                    size="xs"
                    icon={<Icon name="FaEdit" />}
                    tooltip="Editar configuración"
                    onClick={() => onEdit(item.id)}
                    className="w-full hover:scale-100 active:scale-100"
                  />
                  <ActionButton
                    variant="soft"
                    size="xs"
                    icon={
                      <Icon
                        name={item.isActive ? "toggleOn" : "powerOff"}
                        className={item.isActive ? "text-green-500" : "text-gray-400 dark:text-gray-500"}
                      />
                    }
                    tooltip={item.isActive ? "SMTP activo" : "Activar SMTP"}
                    onClick={() => onActivate(item)}
                    className="w-full hover:scale-100 active:scale-100"
                  />
                  <ActionButton
                    variant="soft"
                    size="xs"
                    icon={<Icon name="FaTrash" />}
                    tooltip="Eliminar configuración"
                    onClick={() => onDelete(item)}
                    className="w-full hover:scale-100 active:scale-100"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AIPlaceholderCard = () => (
  <SectionCard
    title="AI"
    icon="FaBrain"
    description="La columna de inteligencia artificial se mantiene visible, pero por ahora continúa ligada a variables de entorno."
  >
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-6 dark:border-gray-700 dark:bg-slate-900/60">
        <p className={`text-sm font-medium ${TXT_TITLE}`}>Siguiente etapa recomendada</p>
        <p className={`mt-2 text-sm ${TXT_BODY}`}>
          Replicar el mismo patrón de SMTP: lista de configuraciones, una activa, edición por modal, prueba controlada y cambio de consumo desde variables de entorno a fuente persistida.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {[
          ["Estado actual", "Pendiente de migración"],
          ["Fuente vigente", "Variables de entorno"],
          ["Objetivo", "Multiples perfiles con una activa"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-slate-900/60">
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>{label}</p>
            <p className={`mt-1 text-sm font-medium ${TXT_TITLE}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  </SectionCard>
);

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState("integrations");
  const [smtpItems, setSmtpItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasLoadedSmtpRef = useRef(false);

  useDocumentTitle("Configuración del Sistema");

  const loadSmtpConfigs = async () => {
    setIsLoading(true);
    try {
      const result = await smtpConfigService.list({ limit: 100 });
      setSmtpItems(Array.isArray(result?.items) ? result.items : []);
    } catch (error) {
      setSmtpItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasLoadedSmtpRef.current) return;
    hasLoadedSmtpRef.current = true;
    loadSmtpConfigs();
  }, []);

  const openCreateModal = () => {
    ModalManager.show({
      type: "custom",
      title: "Nueva configuración SMTP",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <SmtpConfigModal
          mode={SMTP_MODAL_MODES.CREATE}
          config={null}
          onSubmit={async (payload) => {
            const created = await smtpConfigService.create(payload);
            toastSuccess("Configuración SMTP creada", `Se guardó "${created?.name ?? "la configuración"}".`);
            ModalManager.closeAll();
            await loadSmtpConfigs();
          }}
          onClose={() => ModalManager.closeAll()}
        />
      ),
    });
  };

  const openEditModal = async (id) => {
    try {
      const detail = await smtpConfigService.getById(id);
      ModalManager.show({
        type: "custom",
        title: "Editar configuración SMTP",
        size: "clientWide",
        showHeader: false,
        showFooter: false,
        content: (
          <SmtpConfigModal
            mode={SMTP_MODAL_MODES.EDIT}
            config={detail}
            onSubmit={async (payload) => {
              const updated = await smtpConfigService.update(id, payload);
              toastSuccess("Configuración SMTP actualizada", `Se actualizó "${updated?.name ?? "la configuración"}".`);
              ModalManager.closeAll();
              await loadSmtpConfigs();
            }}
            onDelete={async () => {
              const confirmed = await ModalManager.confirm({
                title: "Confirmar eliminación SMTP",
                message: `¿Deseas eliminar la configuración "${detail?.name ?? "seleccionada"}"? Esta acción la quitará de la lista.`,
                confirmText: "Eliminar",
                cancelText: "Cancelar",
              });

              if (!confirmed) return;

              await smtpConfigService.remove(id);
              toastSuccess("Configuración SMTP eliminada", `Se eliminó "${detail?.name ?? "la configuración"}".`);
              ModalManager.closeAll();
              await loadSmtpConfigs();
            }}
            onClose={() => ModalManager.closeAll()}
          />
        ),
      });
    } catch (error) {
      toastError("No se pudo abrir SMTP", error?.message ?? "No fue posible cargar el detalle para edición.");
    }
  };

  const handleActivate = async (item) => {
    if (item?.isActive) {
      if (smtpItems.length <= 1) {
        ModalManager.warning({
          title: "No se puede desactivar SMTP",
          message:
            "Esta es la única configuración SMTP disponible. Puedes eliminarla si ya no la necesitas, pero no puedes dejarla inactiva desde aquí.",
        });
        return;
      }

      ModalManager.info({
        title: "SMTP ya activa",
        message: "Esta configuración ya está en uso. Si quieres cambiar la vigente, activa otra configuración de la lista.",
      });
      return;
    }

    const confirmed = await ModalManager.confirm({
      title: "Confirmar activación SMTP",
      message: `¿Deseas dejar activa la configuración "${item?.name ?? "seleccionada"}"? La configuración SMTP activa actual dejará de estar vigente.`,
      confirmText: "Activar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    try {
      const updated = await smtpConfigService.activate(item.id);
      toastSuccess("Configuración activa actualizada", `"${updated?.name ?? "La configuración"}" quedó en uso.`);
      await loadSmtpConfigs();
    } catch (error) {
      toastError("No se pudo activar SMTP", error?.message ?? "La activación no pudo completarse.");
    }
  };

  const openSendTestModal = (item) => {
    ModalManager.show({
      type: "custom",
      title: "Enviar prueba SMTP",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <SendSmtpTestModal
          config={item}
          onClose={() => ModalManager.closeAll()}
          onSent={() => loadSmtpConfigs()}
        />
      ),
    });
  };

  const handleDelete = async (item) => {
    const confirmed = await ModalManager.confirm({
      title: "Confirmar eliminación SMTP",
      message: `¿Deseas eliminar la configuración "${item?.name ?? "seleccionada"}"? Esta acción la quitará de la lista.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    try {
      await smtpConfigService.remove(item.id);
      toastSuccess("Configuración SMTP eliminada", `Se eliminó "${item?.name ?? "la configuración"}".`);
      await loadSmtpConfigs();
    } catch (error) {
      toastError("No se pudo eliminar SMTP", error?.message ?? "La eliminación no pudo completarse.");
    }
  };

  return (
    <div className="space-y-6">
      <Header />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "summary" && <SummaryPanel smtpItems={smtpItems} />}

      {activeTab === "integrations" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <SectionCard
              title="SMTP"
              icon="FaEnvelope"
              description="Múltiples configuraciones persistidas, una sola activa, edición por modal y prueba obligatoria antes del guardado."
              actions={
                <ActionButton
                  label="Nueva configuración"
                  onClick={openCreateModal}
                  variant="primary"
                  size="sm"
                  icon={<Icon name="FaPlus" />}
                />
              }
            >
              <SmtpTable
                items={smtpItems}
                isLoading={isLoading}
                onEdit={openEditModal}
                onActivate={handleActivate}
                onSend={openSendTestModal}
                onDelete={handleDelete}
              />
            </SectionCard>
          </div>

          <div className="space-y-6">
            <AIPlaceholderCard />
          </div>
        </div>
      )}

      {activeTab === "maintenance" && (
        <PlaceholderPanel
          title="Mantenimiento"
          description="Aquí podemos continuar después con jobs programados, observabilidad de colas y acciones operativas del scheduler sin mezclarlo con el avance de SMTP."
        />
      )}

      {activeTab === "backups" && (
        <PlaceholderPanel
          title="Respaldos"
          description="Esta pestaña queda reservada para políticas de backup e historial. No la estoy tocando en esta iteración para mantener el cambio pequeño y coherente."
        />
      )}
    </div>
  );
};

export default SystemSettings;
