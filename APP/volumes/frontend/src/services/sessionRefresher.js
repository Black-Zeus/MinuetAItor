/**
 * services/sessionRefresher.js
 * Auto-refresh programado basado en la expiración del access_token.
 *
 * v2:
 *  - No hay refresh_token separado.
 *  - Se refresca usando access_token actual como Bearer (/auth/refresh).
 */

import { getAccessToken, hasAccessToken, reconnectSessionSilent } from "./axiosInterceptor";

// ===================================================
// JWT decode (solo exp) — robusto para base64url + padding
// ===================================================
const decodeJwtPayload = (jwt) => {
  try {
    const parts = String(jwt || "").split(".");
    if (parts.length < 2) return null;

    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");

    // padding
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);

    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

// ===================================================
// Cálculo del delay hasta el próximo refresh
// ===================================================
const computeNextDelayMs = ({
  accessToken,
  leadPercent = 0.10,
  minLeadSeconds = 60,
  skewSeconds = 5,
}) => {
  if (!accessToken) return 0;

  const payload = decodeJwtPayload(accessToken);
  if (!payload?.exp) return 0;

  const now = Math.floor(Date.now() / 1000);
  const ttl = payload.exp - now;

  if (ttl <= 0) return 0;

  const leadByPercent = Math.ceil(ttl * leadPercent);
  const lead = Math.max(minLeadSeconds, leadByPercent) + skewSeconds;

  const triggerAt = payload.exp - lead;
  const delaySec = Math.max(0, triggerAt - now);

  return delaySec * 1000;
};

// ===================================================
// Estado del timer
// ===================================================
let timerId = null;
let opts = null;
let activeRunToken = 0;

const clearTimer = () => {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
};

const schedule = async () => {
  clearTimer();

  // Detenido o no hay token => nada que hacer
  if (!opts) return;
  if (!hasAccessToken()) return;

  const delayMs = computeNextDelayMs({
    accessToken: getAccessToken(),
    leadPercent: opts.leadPercent,
    minLeadSeconds: opts.minLeadSeconds,
    skewSeconds: opts.skewSeconds,
  });

  const myRunToken = ++activeRunToken;

  const run = async () => {
    // si se detuvo entre schedule y run
    if (!opts) return;

    try {
      await reconnectSessionSilent(opts.minTTLSeconds);
    } catch {
      // Backoff mínimo para evitar loop agresivo si falla el refresh
      if (!opts) return;
      const backoffMs = Math.max(5_000, opts.failBackoffMs ?? 10_000);
      timerId = setTimeout(() => {
        if (opts && myRunToken === activeRunToken) schedule();
      }, backoffMs);
      return;
    }

    // Reprogramar con el nuevo exp
    if (opts && myRunToken === activeRunToken) schedule();
  };

  // Evitar reintentos inmediatos en loop
  const minScheduleMs = Math.max(1_000, opts.minScheduleMs ?? 1_500);

  if (delayMs <= 0) {
    timerId = setTimeout(run, minScheduleMs);
  } else {
    timerId = setTimeout(run, delayMs);
  }
};

// ===================================================
// API Pública
// ===================================================

/**
 * Inicia auto-refresh programado cerca del vencimiento del access_token.
 * Devuelve función stop().
 *
 * @param {Object} options
 * @param {number} [options.leadPercent=0.10]
 * @param {number} [options.minLeadSeconds=120]
 * @param {number} [options.skewSeconds=5]
 * @param {number} [options.minTTLSeconds=120]
 * @param {boolean}[options.bindWindowListeners=true]
 * @param {number} [options.minScheduleMs=1500]     - mínimo delay cuando delayMs<=0
 * @param {number} [options.failBackoffMs=10000]    - backoff si refresh falla
 * @returns {Function} stop()
 */
export const startSessionAutoRefresh = (options = {}) => {
  opts = {
    leadPercent: 0.10,
    minLeadSeconds: 120,
    skewSeconds: 5,
    minTTLSeconds: 120,
    bindWindowListeners: true,
    minScheduleMs: 1500,
    failBackoffMs: 10000,
    ...options,
  };

  schedule();

  if (opts.bindWindowListeners && typeof window !== "undefined") {
    const reschedule = () => schedule();

    const onVisibility = () => {
      if (document.visibilityState === "visible") reschedule();
    };

    window.addEventListener("focus", reschedule);
    window.addEventListener("online", reschedule);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimer();
      opts = null;
      activeRunToken++; // invalida runs pendientes

      window.removeEventListener("focus", reschedule);
      window.removeEventListener("online", reschedule);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }

  return () => {
    clearTimer();
    opts = null;
    activeRunToken++;
  };
};
