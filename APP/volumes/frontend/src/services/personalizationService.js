import api from "@/services/axiosInterceptor";
import { API_ENDPOINTS } from "@/constants";
import { extractErrorMessage } from "@/utils/errors";

const unwrap = (response) => response?.data?.result ?? response?.data ?? {};

const normalizeTheme = (value) => {
  const theme = String(value || "").trim();
  return ["light", "dark", "system"].includes(theme) ? theme : undefined;
};

const normalizePersonalization = (payload = {}) => ({
  theme: normalizeTheme(payload?.theme),
  density: String(payload?.density || "comfortable"),
  animations: Boolean(payload?.animations ?? true),
  sidebarCollapsed: Boolean(payload?.sidebarCollapsed ?? payload?.sidebar_collapsed ?? false),
  defaultModuleView: String(payload?.defaultModuleView ?? payload?.default_module_view ?? "base"),
  dashboardWidgets: Array.isArray(payload?.dashboardWidgets ?? payload?.dashboard_widgets)
    ? (payload?.dashboardWidgets ?? payload?.dashboard_widgets).map((item) => ({
        code: String(item?.code || "").trim(),
        enabled: Boolean(item?.enabled),
        sortOrder: Number(item?.sortOrder ?? item?.sort_order ?? 0) || null,
      })).filter((item) => item.code)
    : [],
});

const toPersonalizationError = (error, fallbackMessage) => {
  if (error?.response?.data) {
    return new Error(extractErrorMessage(error.response.data, fallbackMessage));
  }
  if (error?.code === "ERR_NETWORK" || !error?.response) {
    return new Error("No fue posible sincronizar tu personalización.");
  }
  return new Error(fallbackMessage);
};

const personalizationService = {
  async getMyPersonalization() {
    try {
      const response = await api.get(API_ENDPOINTS.AUTH.ME_PERSONALIZATION);
      return normalizePersonalization(unwrap(response));
    } catch (error) {
      throw toPersonalizationError(error, "No fue posible cargar tu personalización.");
    }
  },

  async updateMyPersonalization(payload = {}) {
    try {
      const response = await api.put(API_ENDPOINTS.AUTH.ME_PERSONALIZATION, {
        theme: payload?.theme,
        density: payload?.density,
        animations: Boolean(payload?.animations),
        sidebarCollapsed: Boolean(payload?.sidebarCollapsed),
        defaultModuleView: payload?.defaultModuleView,
        dashboardWidgets: Array.isArray(payload?.dashboardWidgets)
          ? payload.dashboardWidgets.map((item) => ({
              code: String(item?.code || "").trim(),
              enabled: Boolean(item?.enabled),
              sortOrder: Number(item?.sortOrder ?? 0) || null,
            })).filter((item) => item.code)
          : [],
      });
      return normalizePersonalization(unwrap(response));
    } catch (error) {
      throw toPersonalizationError(error, "No fue posible guardar tu personalización.");
    }
  },
};

export default personalizationService;
export { normalizePersonalization };
