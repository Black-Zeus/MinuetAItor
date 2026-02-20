// utils/connectionUtils.js

export const isNonEmpty = (v) => v != null && String(v).trim() !== "";

export const toUiConnection = (c) => ({
  ts:       c?.ts ?? null,
  device:   c?.device ?? "Desconocido",
  location: c?.location ?? "Desconocido",
  // Normaliza v4: backend ip_v4 → UI ip
  ip:       c?.ip ?? c?.ip_v4 ?? "",
  // v6 se mantiene
  ip_v6:    c?.ip_v6 ?? "",
});

/**
 * Resuelve conexión actual desde un objeto "session-like"
 * 1) session.activeConnection (normalizado)
 * 2) fallback a lastAccess/lastDevice/...
 */
export const resolveCurrentConnection = (session) => {
  const ac = session?.activeConnection;

  if (ac && typeof ac === "object") {
    return {
      ts:       ac.ts       ?? session?.lastAccess   ?? null,
      device:   ac.device   ?? session?.lastDevice   ?? "Desconocido",
      location: ac.location ?? session?.lastLocation ?? "Desconocido",
      ip_v4:    ac.ip       ?? ac.ip_v4 ?? session?.lastIp ?? "",
      ip_v6:    ac.ip_v6    ?? session?.lastIpV6     ?? "",
    };
  }

  return {
    ts:       session?.lastAccess   ?? null,
    device:   session?.lastDevice   ?? "Desconocido",
    location: session?.lastLocation ?? "Desconocido",
    ip_v4:    session?.lastIp       ?? "",
    ip_v6:    session?.lastIpV6     ?? "",
  };
};

export const buildIpLines = ({ ip_v4, ip_v6 }) => {
  const v4 = String(ip_v4 ?? "").trim();
  const v6 = String(ip_v6 ?? "").trim();

  const lines = [];
  if (isNonEmpty(v4)) lines.push({ label: "IPv4", value: v4 });
  if (isNonEmpty(v6)) lines.push({ label: "IPv6", value: v6 });

  if (!lines.length) lines.push({ label: "IP", value: "—" });

  return lines;
};
