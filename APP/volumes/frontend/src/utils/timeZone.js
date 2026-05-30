import timeZonesCatalog from "@/data/timeZones.json";

export const BROWSER_TIMEZONE = "browser";
export const FALLBACK_TIMEZONE = "America/Santiago";

const TIMEZONE_ALIASES = {
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Catamarca": "America/Argentina/Catamarca",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Jujuy": "America/Argentina/Jujuy",
  "America/Mendoza": "America/Argentina/Mendoza",
};

const SUPPORTED_TIMEZONES = new Set(
  Object.values(timeZonesCatalog)
    .flatMap((items) => (Array.isArray(items) ? items : []))
    .map((item) => item?.value)
    .filter(Boolean)
);

export const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
};

export const isValidTimeZone = (value) => {
  if (!value || value === BROWSER_TIMEZONE) return true;
  return SUPPORTED_TIMEZONES.has(TIMEZONE_ALIASES[value] ?? value);
};

export const normalizeTimeZone = (value) => {
  const normalized = String(value || "").trim();
  const canonical = TIMEZONE_ALIASES[normalized] ?? normalized;
  return isValidTimeZone(canonical) ? canonical || BROWSER_TIMEZONE : BROWSER_TIMEZONE;
};

export const resolveTimeZone = (value) => {
  const normalized = normalizeTimeZone(value);
  return normalized === BROWSER_TIMEZONE ? getBrowserTimeZone() : normalized;
};
