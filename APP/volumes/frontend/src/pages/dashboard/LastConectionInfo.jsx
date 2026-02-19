/**
 * LastConectionInfo.jsx
 * Muestra información de la última conexión del usuario.
 * Lee los datos desde dashboardStore → session.
 *
 * Fuentes (prioridad):
 *  1. session.activeConnection  → conexión actual explícita (nodo dedicado)
 *  2. session.lastAccess / lastDevice / lastLocation / lastIp  → fallback compat
 *
 * Historial:
 *  - session.lastConnections[]  → colapsable, por defecto cerrado
 *  - UI muestra últimas 5
 *
 * IP:
 *  - IPv4: conn.ip
 *  - IPv6: conn.ip_v6
 *  - Si existe una u otra, se muestra la disponible.
 *  - Si existen ambas, se muestran ambas.
 */

import React, { useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import useDashboardStore from "@store/dashboardStore";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY  = "text-gray-600 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";

// ─── Formatea ISO → "DD MMM YYYY, HH:MM" ─────────────────────────────────────
const formatDate = (iso) => {
  if (!iso) return "Sin registro";
  try {
    return new Date(iso).toLocaleString("es-CL", {
      day:    "2-digit",
      month:  "short",
      year:   "numeric",
      hour:   "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Sin registro";
  }
};

const isNonEmpty = (v) => v != null && String(v).trim() !== "";

// ─── Resuelve "conexión actual":
//     1) session.activeConnection (nodo explícito)
//     2) fallback compat (lastAccess / lastDevice / etc.)
// ─────────────────────────────────────────────────────────────────────────────
const resolveCurrentConnection = (session) => {
  const ac = session?.activeConnection;

  if (ac && typeof ac === "object") {
    return {
      ts:       ac.ts       ?? session?.lastAccess   ?? null,
      device:   ac.device   ?? session?.lastDevice   ?? "Desconocido",
      location: ac.location ?? session?.lastLocation ?? "Desconocido",
      ip_v4:    ac.ip       ?? session?.lastIp       ?? "",
      ip_v6:    ac.ip_v6    ?? "",
    };
  }

  // Fallback absoluto: campos compat del store
  return {
    ts:       session?.lastAccess   ?? null,
    device:   session?.lastDevice   ?? "Desconocido",
    location: session?.lastLocation ?? "Desconocido",
    ip_v4:    session?.lastIp       ?? "",
    ip_v6:    session?.lastIpV6     ?? "",
  };
};

function isEmpty(str) {
    return (!str || str.length === 0 );
}

const buildIpLines = ({ ip_v4, ip_v6 }) => {
  const lines = [];
  if (isEmpty(ip_v4)) ip_v4 = " - "
  if (isEmpty(ip_v6)) ip_v6 = " - "


  lines.push({ label: "IPv4", value: String(ip_v4).trim() });
  lines.push({ label: "IPv6", value: String(ip_v6).trim() });

  return lines;
};

// ─── Info pill (1 línea) ─────────────────────────────────────────────────────
const InfoPill = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 transition-theme">
    <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 shadow-sm transition-theme">
      <Icon name={icon} className="w-3.5 h-3.5 text-primary-500 dark:text-primary-400" />
    </div>
    <div className="min-w-0">
      <p className={`text-xs ${TXT_META} transition-theme`}>{label}</p>
      <p className={`text-sm font-semibold ${TXT_TITLE} truncate transition-theme`}>
        {value || "—"}
      </p>
    </div>
  </div>
);

// ─── Info pill (multi-línea) para IP v4/v6 ────────────────────────────────────
const InfoPillMulti = ({ icon, label, lines }) => (
  <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 transition-theme">
    <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 shadow-sm transition-theme mt-0.5">
      <Icon name={icon} className="w-3.5 h-3.5 text-primary-500 dark:text-primary-400" />
    </div>
    <div className="min-w-0 flex-1">
      <p className={`text-xs ${TXT_META} transition-theme`}>{label}</p>
      {lines?.length ? (
        <div className="mt-1 space-y-1">
          {lines.map((x, idx) => (
            <div key={`${x.label}-${idx}`} className="flex items-baseline gap-2 min-w-0">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 shrink-0">
                {x.label}:
              </span>
              <span className={`text-sm font-semibold ${TXT_TITLE} truncate transition-theme`}>
                {x.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className={`text-sm font-semibold ${TXT_TITLE} transition-theme mt-0.5`}>—</p>
      )}
    </div>
  </div>
);

// ─── Fila de historial ────────────────────────────────────────────────────────
const ConnectionRow = ({ conn, isFirst }) => {
  const ipLines = buildIpLines({ ip_v4: conn?.ip ?? "", ip_v6: conn?.ip_v6 ?? "" });

  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-xl bg-white dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700/50 transition-theme">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${TXT_TITLE} transition-theme`}>
            {formatDate(conn?.ts ?? null)}
          </span>          
        </div>
        <p className={`text-sm ${TXT_BODY} transition-theme mt-0.5 truncate`}>
          {conn?.device ?? "Desconocido"}
        </p>
        <p className={`text-xs ${TXT_META} transition-theme mt-0.5 truncate`}>
          {conn?.location ?? "Desconocido"}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {ipLines.length ? (
          <div className="space-y-1">
            {ipLines.map((x, idx) => (
              <div key={`${x.label}-${idx}`} className="flex items-baseline gap-2 justify-end">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  {x.label}
                </span>
                <span className={`text-xs font-semibold ${TXT_TITLE} transition-theme`}>
                  {x.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className={`text-xs font-semibold ${TXT_META} transition-theme`}>—</span>
        )}
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const LastConectionInfo = () => {
  const session = useDashboardStore((s) => s.session);

  // Historial colapsable — cerrado por defecto
  const [historyOpen, setHistoryOpen] = useState(false);

  const history  = Array.isArray(session?.lastConnections) ? session.lastConnections : [];
  const current  = resolveCurrentConnection(session);
  const ipLines  = buildIpLines({ ip_v4: current.ip_v4, ip_v6: current.ip_v6 });
  const lastXConnections    = history.slice(0, 5);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className={`text-lg font-bold ${TXT_TITLE} flex items-center gap-2 transition-theme`}>
            <Icon name="FaClock" className="text-primary-500 dark:text-primary-400 w-4 h-4" />
            Última conexión
          </h2>
          <p className={`text-sm ${TXT_BODY} mt-0.5 transition-theme`}>
            Información de tu sesión más reciente.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-green-700 dark:text-green-400">
            {session?.isLoggedIn ? "Sesión activa" : "Sesión no activa"}
          </span>
        </div>
      </div>

      {/* ── Grid info conexión actual ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <InfoPill
          icon="FaCalendarAlt"
          label="Fecha y hora"
          value={formatDate(current.ts)}
        />
        <InfoPill
          icon="FaDesktop"
          label="Dispositivo"
          value={current.device}
        />
        <InfoPill
          icon="FaLocationDot"
          label="Ubicación"
          value={current.location}
        />
        <InfoPillMulti
          icon="FaNetworkWired"
          label="Dirección IP"
          lines={ipLines}
        />
      </div>

      {/* ── Historial colapsable ── */}
      <div className="mt-5 border border-gray-200 dark:border-gray-700/60 rounded-xl overflow-hidden transition-theme">

        {/* Cabecera toggle */}
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className={`
            w-full flex items-center justify-between px-4 py-3
            bg-gray-50 dark:bg-gray-900/40
            hover:bg-gray-100 dark:hover:bg-gray-900/60
            transition-theme cursor-pointer select-none
          `}
        >
          <span className={`text-sm font-bold ${TXT_TITLE} flex items-center gap-2 transition-theme`}>
            <Icon
              name="FaClockRotateLeft"
              className="text-primary-500 dark:text-primary-400 w-3.5 h-3.5"
            />
            {`Últimas ${lastXConnections.length} conexiones `}             
          </span>

          <Icon
            name={historyOpen ? "FaChevronUp" : "FaChevronDown"}
            className={`w-3.5 h-3.5 ${TXT_META} transition-transform`}
          />
        </button>

        {/* Contenido */}
        {historyOpen && (
          <div className="p-4">
            {lastXConnections.length ? (
              <div className="space-y-2">
                {lastXConnections.map((c, idx) => (
                  <ConnectionRow
                    key={`${c?.ts ?? idx}-${idx}`}
                    conn={c}
                    isFirst={idx === 0}
                  />
                ))}
              </div>
            ) : (
              <p className={`text-sm ${TXT_BODY} transition-theme`}>
                Sin historial de conexiones.
              </p>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default LastConectionInfo;