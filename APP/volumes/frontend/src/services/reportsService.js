import api from "@/services/axiosInterceptor";

const BASE = "/v1/reports";

export const previewReportPdfBlob = async (payload) => {
  const res = await api.post(`${BASE}/pdf-preview`, payload, {
    responseType: "blob",
  });
  return res.data;
};

