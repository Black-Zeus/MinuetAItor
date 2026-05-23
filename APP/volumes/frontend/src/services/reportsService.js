import api from "@/services/axiosInterceptor";

const BASE = "/v1/reports";

const unwrap = (res) => res?.data?.result ?? res?.data;

export const previewReportPdfBlob = async (payload) => {
  const res = await api.post(`${BASE}/pdf-preview`, payload, {
    responseType: "blob",
  });
  return res.data;
};

export const listManagementTopicAnalytics = async ({
  reportType,
  dateFrom = null,
  dateTo = null,
  client = null,
  project = null,
  limit = 200,
} = {}, requestConfig = {}) => {
  const payload = {
    report_type: reportType,
    date_from: dateFrom || null,
    date_to: dateTo || null,
    client: client || null,
    project: project || null,
    limit,
  };
  const res = await api.post(`${BASE}/management/topic-analytics`, payload, requestConfig);
  return unwrap(res);
};
