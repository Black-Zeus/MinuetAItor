export const BROWSER_TIMEZONE = "browser";
export const FALLBACK_TIMEZONE = "America/Santiago";

export const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
};

export const isValidTimeZone = (value) => {
  if (!value || value === BROWSER_TIMEZONE) return true;
  try {
    new Intl.DateTimeFormat("es-CL", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const normalizeTimeZone = (value) => {
  const normalized = String(value || "").trim();
  return isValidTimeZone(normalized) ? normalized || BROWSER_TIMEZONE : BROWSER_TIMEZONE;
};

export const resolveTimeZone = (value) => {
  const normalized = normalizeTimeZone(value);
  return normalized === BROWSER_TIMEZONE ? getBrowserTimeZone() : normalized;
};
