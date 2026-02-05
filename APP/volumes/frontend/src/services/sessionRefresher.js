// services/sessionRefresher.js
import { getAccessToken, hasRefreshToken, reconnectSessionSilent } from './axiosInterceptor';

const decodeJwtPayload = (jwt) => {
  try {
    const [, b64] = jwt.split('.');
    if (!b64) return null;
    const json = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch { return null; }
};

const computeNextDelayMs = ({ accessToken, leadPercent = 0.10, minLeadSeconds = 60, skewSeconds = 5 }) => {
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

let timerId = null;
let opts = null;

const clearTimer = () => { if (timerId) { clearTimeout(timerId); timerId = null; } };

const schedule = async () => {
  clearTimer();
  if (!hasRefreshToken()) return;

  const delayMs = computeNextDelayMs({
    accessToken: getAccessToken(),
    leadPercent: opts.leadPercent,
    minLeadSeconds: opts.minLeadSeconds,
    skewSeconds: opts.skewSeconds,
  });

  const run = async () => {
    try {
      await reconnectSessionSilent(opts.minTTLSeconds);
    } finally {
      schedule(); // reprogramar con el nuevo exp
    }
  };

  if (delayMs <= 0) run();
  else timerId = setTimeout(run, delayMs);
};

/**
 * Inicia auto-refresh programado cerca del vencimiento.
 * Devuelve función para detener.
 */
export const startSessionAutoRefresh = (options = {}) => {
  opts = {
    leadPercent: 0.10,   // 10% del TTL
    minLeadSeconds: 120, // al menos 2 min antes
    skewSeconds: 5,
    minTTLSeconds: 120,  // si faltan <= 2 min, refrescar
    bindWindowListeners: true,
    ...options,
  };

  schedule();

  if (opts.bindWindowListeners && typeof window !== 'undefined') {
    const reschedule = () => schedule();
    window.addEventListener('focus', reschedule);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reschedule();
    });
    window.addEventListener('online', reschedule);

    return () => {
      clearTimer();
      window.removeEventListener('focus', reschedule);
      window.removeEventListener('visibilitychange', reschedule);
      window.removeEventListener('online', reschedule);
      opts = null;
    };
  }

  return () => { clearTimer(); opts = null; };
};
