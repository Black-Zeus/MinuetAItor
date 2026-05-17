import React, { useEffect, useMemo, useRef, useState } from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import AiProviderConfigModal, {
  AI_PROVIDER_MODAL_MODES,
  AiProviderValidationModal,
} from "@/pages/system/AiProviderConfigModal";
import SmtpConfigModal, { SMTP_MODAL_MODES } from "@/pages/system/SmtpConfigModal";
import { BackupsPanel } from "@/pages/system/SystemSettingsBackupsPanel";
import { MaintenancePanel } from "@/pages/system/SystemSettingsMaintenancePanel";
import {
  AIProviderTable,
  SendSmtpTestModal,
  SmtpTable,
  SummaryPanel,
} from "@/pages/system/SystemSettingsOverview";
import {
  Header,
  SectionCard,
  TabNav,
} from "@/pages/system/SystemSettingsShared";
import aiProviderConfigService from "@/services/aiProviderConfigService";
import smtpConfigService from "@/services/smtpConfigService";

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState("summary");
  const [smtpItems, setSmtpItems] = useState([]);
  const [aiItems, setAiItems] = useState([]);
  const [aiProviderCatalog, setAiProviderCatalog] = useState([]);
  const [isSmtpLoading, setIsSmtpLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const hasLoadedSmtpRef = useRef(false);
  const hasLoadedAiRef = useRef(false);

  useDocumentTitle("Configuración del Sistema");

  const loadSmtpConfigs = async () => {
    setIsSmtpLoading(true);
    try {
      const result = await smtpConfigService.list({ limit: 100 });
      setSmtpItems(Array.isArray(result?.items) ? result.items : []);
    } catch (error) {
      setSmtpItems([]);
    } finally {
      setIsSmtpLoading(false);
    }
  };

  const loadAiConfigs = async () => {
    setIsAiLoading(true);
    try {
      const result = await aiProviderConfigService.list({ limit: 100 });
      setAiItems(Array.isArray(result?.items) ? result.items : []);
    } catch (error) {
      setAiItems([]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const loadAiProviderCatalog = async () => {
    try {
      const result = await aiProviderConfigService.getCatalog();
      setAiProviderCatalog(Array.isArray(result) ? result : []);
    } catch (error) {
      setAiProviderCatalog([]);
    }
  };

  useEffect(() => {
    if (hasLoadedSmtpRef.current) return;
    hasLoadedSmtpRef.current = true;
    loadSmtpConfigs();
  }, []);

  useEffect(() => {
    if (hasLoadedAiRef.current) return;
    hasLoadedAiRef.current = true;
    loadAiProviderCatalog();
    loadAiConfigs();
  }, []);

  const aiProviderLabelMap = useMemo(
    () =>
      Object.fromEntries(
        (Array.isArray(aiProviderCatalog) ? aiProviderCatalog : [])
          .map((item) => [String(item?.id || "").trim(), String(item?.label || "").trim()])
          .filter(([id, label]) => id && label)
      ),
    [aiProviderCatalog]
  );

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

  const openCreateAiModal = () => {
    ModalManager.show({
      type: "custom",
      title: "Nueva configuración AI",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <AiProviderConfigModal
          mode={AI_PROVIDER_MODAL_MODES.CREATE}
          config={null}
          providerCatalog={aiProviderCatalog}
          onSubmit={async (payload) => {
            const created = await aiProviderConfigService.create(payload);
            toastSuccess("Configuración AI creada", `Se guardó "${created?.name ?? "la configuración"}".`);
            ModalManager.closeAll();
            await loadAiConfigs();
          }}
          onClose={() => ModalManager.closeAll()}
        />
      ),
    });
  };

  const openEditAiModal = async (id) => {
    try {
      const detail = await aiProviderConfigService.getById(id);
      ModalManager.show({
        type: "custom",
        title: "Editar configuración AI",
        size: "clientWide",
        showHeader: false,
        showFooter: false,
        content: (
          <AiProviderConfigModal
            mode={AI_PROVIDER_MODAL_MODES.EDIT}
            config={detail}
            providerCatalog={aiProviderCatalog}
            onSubmit={async (payload) => {
              const updated = await aiProviderConfigService.update(id, payload);
              toastSuccess("Configuración AI actualizada", `Se actualizó "${updated?.name ?? "la configuración"}".`);
              ModalManager.closeAll();
              await loadAiConfigs();
            }}
            onDelete={async () => {
              const confirmed = await ModalManager.confirm({
                title: "Confirmar eliminación AI",
                message: `¿Deseas eliminar la configuración "${detail?.name ?? "seleccionada"}"?`,
                confirmText: "Eliminar",
                cancelText: "Cancelar",
              });

              if (!confirmed) return;

              await aiProviderConfigService.remove(id);
              toastSuccess("Configuración AI eliminada", `Se eliminó "${detail?.name ?? "la configuración"}".`);
              ModalManager.closeAll();
              await loadAiConfigs();
            }}
            onClose={() => ModalManager.closeAll()}
          />
        ),
      });
    } catch (error) {
      toastError("No se pudo abrir AI", error?.message ?? "No fue posible cargar el detalle para edición.");
    }
  };

  const openAiValidationModal = (item) => {
    ModalManager.show({
      type: "custom",
      title: "Validar configuración AI",
      size: "clientWide",
      showHeader: false,
      showFooter: false,
      content: (
        <AiProviderValidationModal
          config={item}
          providerCatalog={aiProviderCatalog}
          onClose={() => ModalManager.closeAll()}
          onValidated={() => loadAiConfigs()}
        />
      ),
    });
  };

  const handleAiToggleActive = async (item) => {
    if (item?.isActive) {
      const confirmed = await ModalManager.confirm({
        title: "Desactivar configuración AI",
        message: `¿Deseas desactivar "${item?.name ?? "la configuración"}"? Si continúas, el sistema quedará sin configuración AI activa registrada.`,
        confirmText: "Desactivar",
        cancelText: "Cancelar",
      });

      if (!confirmed) return;

      try {
        await aiProviderConfigService.deactivate(item.id);
        toastSuccess("Configuración AI desactivada", `"${item?.name ?? "La configuración"}" quedó inactiva.`);
        await loadAiConfigs();
      } catch (error) {
        toastError("No se pudo desactivar AI", error?.message ?? "La desactivación no pudo completarse.");
      }
      return;
    }

    if (!item?.modelName) {
      ModalManager.warning({
        title: "Modelo requerido",
        message: "No puedes activar una configuración AI sin modelo configurado.",
      });
      return;
    }

    if (item?.validationStatus !== "valid") {
      ModalManager.warning({
        title: "Validación requerida",
        message: `La configuración "${item?.name ?? "seleccionada"}" debe validarse correctamente antes de activarse.`,
      });
      return;
    }

    const currentActive = aiItems.find((candidate) => candidate.isActive);
    const confirmed = await ModalManager.confirm({
      title: "Confirmar activación AI",
      message: currentActive
        ? `¿Deseas activar "${item?.name ?? "seleccionada"}"? "${currentActive.name}" dejará de estar activa automáticamente.`
        : `¿Deseas activar "${item?.name ?? "seleccionada"}"?`,
      confirmText: "Activar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    try {
      const updated = await aiProviderConfigService.activate(item.id);
      toastSuccess("Configuración AI activa actualizada", `"${updated?.name ?? "La configuración"}" quedó activa.`);
      await loadAiConfigs();
    } catch (error) {
      toastError("No se pudo activar AI", error?.message ?? "La activación no pudo completarse.");
    }
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

  const handleAiDelete = async (item) => {
    const confirmed = await ModalManager.confirm({
      title: "Confirmar eliminación AI",
      message: item?.isActive
        ? `¿Deseas eliminar la configuración activa "${item?.name ?? "seleccionada"}"? Si continúas, el sistema quedará sin configuración AI activa registrada.`
        : `¿Deseas eliminar la configuración "${item?.name ?? "seleccionada"}"?`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
    });

    if (!confirmed) return;

    try {
      await aiProviderConfigService.remove(item.id);
      toastSuccess("Configuración AI eliminada", `Se eliminó "${item?.name ?? "la configuración"}".`);
      await loadAiConfigs();
    } catch (error) {
      toastError("No se pudo eliminar AI", error?.message ?? "La eliminación no pudo completarse.");
    }
  };

  return (
    <div className="space-y-6">
      <Header />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "summary" && <SummaryPanel smtpItems={smtpItems} aiItems={aiItems} />}

      {activeTab === "integrations" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <SectionCard
              title="SMTP"
              icon="FaEnvelope"
              description="Administra las cuentas y servidores de correo que MinuetAItor utilizará para enviar notificaciones, mensajes automáticos y comunicaciones a usuarios y participantes."
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
                isLoading={isSmtpLoading}
                onEdit={openEditModal}
                onActivate={handleActivate}
                onSend={openSendTestModal}
                onDelete={handleDelete}
              />
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard
              title="AI"
              icon="FaBrain"
              description="Administra los proveedores, credenciales y modelos de IA que MinuetAItor podrá usar para analizar, resumir y apoyar el procesamiento de minutas."
              actions={
                <ActionButton
                  label="Nueva configuración"
                  onClick={openCreateAiModal}
                  variant="primary"
                  size="sm"
                  icon={<Icon name="FaPlus" />}
                />
              }
            >
              <AIProviderTable
                items={aiItems}
                isLoading={isAiLoading}
                providerLabelMap={aiProviderLabelMap}
                onEdit={openEditAiModal}
                onValidate={openAiValidationModal}
                onToggleActive={handleAiToggleActive}
                onDelete={handleAiDelete}
              />
            </SectionCard>
          </div>
        </div>
      )}

      {activeTab === "maintenance" && <MaintenancePanel />}

      {activeTab === "backups" && <BackupsPanel />}
    </div>
  );
};

export default SystemSettings;
