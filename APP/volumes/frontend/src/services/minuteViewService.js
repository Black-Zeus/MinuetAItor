import axios from "axios";
import { getFormattedError } from "@/utils/errors";

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

const unwrap = (data) => data?.result ?? data;

const authHeaders = (token) => (
  token
    ? { headers: { "X-Visitor-Token": token } }
    : {}
);

export const requestMinuteViewOtp = async ({ recordId, email }) => {
  try {
    const response = await api.post("/v1/minutes/public/access/request-otp", {
      recordId,
      email,
    });
    return unwrap(response.data);
  } catch (error) {
    throw getFormattedError(error);
  }
};

export const verifyMinuteViewOtp = async ({ recordId, email, otpCode }) => {
  try {
    const response = await api.post("/v1/minutes/public/access/verify-otp", {
      recordId,
      email,
      otpCode,
    });
    return unwrap(response.data);
  } catch (error) {
    throw getFormattedError(error);
  }
};

export const getMinuteViewDetail = async (recordId, token) => {
  try {
    const response = await api.get(`/v1/minutes/public/${recordId}`, authHeaders(token));
    return unwrap(response.data);
  } catch (error) {
    throw getFormattedError(error);
  }
};

export const getMinuteViewPdfBlob = async (recordId, token) => {
  try {
    const response = await api.get(`/v1/minutes/public/${recordId}/pdf`, {
      ...authHeaders(token),
      responseType: "blob",
    });
    return response.data;
  } catch (error) {
    throw getFormattedError(error);
  }
};

export const createMinuteObservation = async (recordId, token, body) => {
  try {
    const response = await api.post(
      `/v1/minutes/public/${recordId}/observations`,
      { body },
      authHeaders(token)
    );
    return unwrap(response.data);
  } catch (error) {
    throw getFormattedError(error);
  }
};

export const logoutMinuteViewSession = async (recordId, token) => {
  try {
    await api.post(`/v1/minutes/public/${recordId}/logout`, {}, authHeaders(token));
    return { success: true };
  } catch (error) {
    throw getFormattedError(error);
  }
};
