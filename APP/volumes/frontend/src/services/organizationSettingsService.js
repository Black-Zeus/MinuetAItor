import axiosInstance from "@/services/axiosInterceptor";

const BASE = "/v1/system/organization";

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

const normalizeBaseUrl = (value) => {
  const text = String(value ?? "").trim();
  return text ? text.replace(/\/+$/, "") : "";
};

const organizationSettingsService = {
  async getConfig() {
    const res = await axiosInstance.get(BASE);
    return unwrap(res);
  },

  async update(payload) {
    const res = await axiosInstance.put(BASE, {
      ...payload,
      publicBaseUrl: normalizeBaseUrl(payload?.publicBaseUrl),
    });
    return unwrap(res);
  },

  async uploadLogo(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axiosInstance.post(`${BASE}/logo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return unwrap(res);
  },

  async deleteLogo() {
    const res = await axiosInstance.delete(`${BASE}/logo`);
    return unwrap(res);
  },

  async uploadBanner(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axiosInstance.post(`${BASE}/banner`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return unwrap(res);
  },

  async deleteBanner() {
    const res = await axiosInstance.delete(`${BASE}/banner`);
    return unwrap(res);
  },
};

export default organizationSettingsService;
