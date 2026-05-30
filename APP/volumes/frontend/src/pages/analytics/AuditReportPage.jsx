import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import AsyncEChart from "@/components/charts/AsyncEChart";
import { openPdfViewer } from "@/components/ui/pdf/PdfViewerModal";
import { AUDIT_REPORT_ITEMS } from "@config/sidebarConfig";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import useTableSorting from "@/hooks/useTableSorting";
import ReportModulePage from "@/pages/analytics/reports/components/ReportModulePage";
import { listAuditEvents, previewReportPdfBlob } from "@/services/reportsService";
import { formatDateTime as formatUserDateTime, formatNumber } from "@/utils/formats";
import logger from "@/utils/logger";

const reportLog = logger.scope("audit-reports");
const ITEMS_PER_PAGE = 10;

const REPORT_TYPE_BY_ID = {
  "audit-user-sessions": "user-sessions",
  "audit-remote-session-close": "remote-session-closes",
  "audit-password-changes": "password-changes",
  "audit-available-activity": "available-audit-activity",
  "audit-minute-otp-requests": "minute-otp-requests",
  "audit-guest-sessions": "guest-sessions",
  "audit-external-observations-evidence": "external-observations-evidence",
  "audit-external-access-by-minute": "external-access-by-minute",
  "audit-available-change-log": "available-audit-activity",
  "audit-changes-by-entity": "changes-by-entity",
  "audit-changes-by-actor": "changes-by-actor",
  "audit-changes-by-period": "changes-by-period",
  "audit-system-sendmail": "system-sendmail",
};

const REPORT_COPY = {
  "audit-user-sessions": {
    icon: "FaClockRotateLeft",
    tableDescription: "Sesiones de usuario registradas con origen, dispositivo y estado de cierre.",
  },
  "audit-remote-session-close": {
    icon: "FaUserShield",
    tableDescription: "Eventos auditados de cierre remoto o masivo de sesiones.",
  },
  "audit-password-changes": {
    icon: "FaKey",
    tableDescription: "Cambios de credenciales ejecutados por administradores.",
  },
  "audit-available-activity": {
    icon: "FaClipboardCheck",
    tableDescription: "Eventos disponibles hoy en la bitácora de auditoría.",
  },
  "audit-minute-otp-requests": {
    icon: "FaEnvelope",
    tableDescription: "Solicitudes OTP emitidas para acceso externo a minutas.",
  },
  "audit-guest-sessions": {
    icon: "FaUsers",
    tableDescription: "Sesiones de invitados emitidas para revisión externa.",
  },
  "audit-external-observations-evidence": {
    icon: "FaCommentAlt",
    tableDescription: "Observaciones externas tratadas como evidencia trazable.",
  },
  "audit-external-access-by-minute": {
    icon: "FaRegFileLines",
    tableDescription: "Resumen de actividad externa agrupada por minuta.",
  },
  "audit-available-change-log": {
    icon: "FaCodeBranch",
    tableDescription: "Cambios que cuentan con cobertura real en la bitácora de auditoría.",
  },
  "audit-changes-by-entity": {
    icon: "FaClipboardList",
    tableDescription: "Eventos auditados agrupados por entidad afectada.",
  },
  "audit-changes-by-actor": {
    icon: "FaUser",
    tableDescription: "Eventos auditados agrupados por actor ejecutor.",
  },
  "audit-changes-by-period": {
    icon: "FaCalendar",
    tableDescription: "Eventos auditados agrupados por fecha.",
  },
  "audit-system-sendmail": {
    icon: "FaEnvelope",
    tableDescription: "Correos emitidos por el sistema con estado, destinatarios y adjuntos.",
  },
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "active", label: "Activa" },
  { value: "closed", label: "Cerrada" },
  { value: "revoked", label: "Revocada" },
  { value: "sent", label: "Enviado" },
  { value: "failed", label: "Fallido" },
  { value: "queued", label: "En cola" },
  { value: "pending", label: "Pendiente" },
  { value: "consumed", label: "Consumido" },
];

const ENTITY_TYPE_OPTIONS = [
  { value: "user", label: "Usuario" },
  { value: "Usuario", label: "Usuario" },
  { value: "user_session", label: "Sesión de usuario" },
  { value: "Sesión de usuario", label: "Sesión de usuario" },
  { value: "audit_log", label: "Bitácora de auditoría" },
  { value: "Bitácora de auditoría", label: "Bitácora de auditoría" },
  { value: "email_delivery", label: "Correo del sistema" },
  { value: "Correo del sistema", label: "Correo del sistema" },
  { value: "visitor_access_request", label: "Solicitud OTP" },
  { value: "Solicitud OTP", label: "Solicitud OTP" },
  { value: "visitor_session", label: "Sesión de invitado" },
  { value: "Sesión de invitado", label: "Sesión de invitado" },
  { value: "record_version_observation", label: "Observación externa" },
  { value: "Observación externa", label: "Observación externa" },
  { value: "record", label: "Minuta" },
  { value: "Minuta", label: "Minuta" },
];

const DEFAULT_FILTERS = {
  dateFrom: "",
  dateTo: "",
  actor: "",
  entityType: "",
  status: "",
  client: "",
  project: "",
};

const DEFAULT_VISIBLE_FILTERS = {
  dateFrom: true,
  dateTo: true,
  actor: true,
  entityType: true,
  status: true,
  client: false,
  project: false,
};

const EXTERNAL_REPORTS = new Set([
  "audit-minute-otp-requests",
  "audit-guest-sessions",
  "audit-external-observations-evidence",
  "audit-external-access-by-minute",
]);

const GROUPED_REPORTS = new Set([
  "audit-changes-by-entity",
  "audit-changes-by-actor",
  "audit-changes-by-period",
]);

const SESSION_REPORTS = new Set([
  "audit-user-sessions",
  "audit-remote-session-close",
]);

const SENDMAIL_REPORTS = new Set(["audit-system-sendmail"]);

const buildSelectOptions = (values, selectedValue = "") => {
  const cleanValues = new Set(
    values
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
  );
  const selected = String(selectedValue ?? "").trim();
  if (selected) cleanValues.add(selected);
  return Array.from(cleanValues)
    .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }))
    .map((value) => ({ value, label: value }));
};

const formatDateTime = (value) => {
  if (!value) return "Sin fecha";
  try {
    return formatUserDateTime(value);
  } catch {
    return String(value);
  }
};

const safeText = (value, fallback = "-") => {
  const clean = String(value ?? "").trim();
  return clean || fallback;
};

const STATUS_META = {
  active: {
    label: "Activa",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300",
  },
  closed: {
    label: "Cerrada",
    className: "bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-300",
  },
  revoked: {
    label: "Revocada",
    className: "bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-300",
  },
  sent: {
    label: "Enviado",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300",
  },
  failed: {
    label: "Fallido",
    className: "bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-300",
  },
  queued: {
    label: "En cola",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/35 dark:text-sky-300",
  },
  pending: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300",
  },
  consumed: {
    label: "Consumido",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/35 dark:text-violet-300",
  },
  audited: {
    label: "Auditado",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-700/70 dark:text-slate-200",
  },
  grouped: {
    label: "Agrupado",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-700/70 dark:text-slate-200",
  },
  with_activity: {
    label: "Con actividad",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300",
  },
};

const getStatusMeta = (status) => {
  const key = String(status ?? "").trim();
  return STATUS_META[key] ?? {
    label: safeText(key, "Sin estado"),
    className: "bg-gray-100 text-gray-700 dark:bg-gray-700/70 dark:text-gray-200",
  };
};

const StatusBadge = ({ status }) => {
  const meta = getStatusMeta(status);
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
};

const buildCsv = (columns, rows) => {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    columns.map((column) => escape(column.label)).join(","),
    ...rows.map((row) =>
      columns
        .map((column) => escape(column.exportValue ? column.exportValue(row) : row[column.key]))
        .join(",")
    ),
  ].join("\n");
};

const downloadTextFile = (filename, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const buildStatusDistribution = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = getStatusMeta(row.status).label;
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
};

const buildActionDistribution = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = safeText(row.action, "Sin acción");
    map.set(key, (map.get(key) ?? 0) + (Number(row.count) || 1));
  });
  return Array.from(map, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);
};

const normalizeRow = (row) => ({
  ...row,
  entityType: row.entityType ?? row.entity_type,
  entityId: row.entityId ?? row.entity_id,
  userAgent: row.userAgent ?? row.user_agent,
  recordId: row.recordId ?? row.record_id,
  recordTitle: row.recordTitle ?? row.record_title,
});

const buildDonutOption = (title, data) => ({
  backgroundColor: "transparent",
  color: ["#2563eb", "#059669", "#f59e0b", "#7c3aed", "#dc2626", "#64748b"],
  title: { text: title, left: 16, top: 12, textStyle: { color: "#e2e8f0", fontSize: 14 } },
  tooltip: { trigger: "item", backgroundColor: "rgba(15,23,42,0.94)", borderColor: "rgba(148,163,184,0.18)" },
  legend: { bottom: 8, textStyle: { color: "#94a3b8" } },
  series: [
    {
      type: "pie",
      radius: ["48%", "70%"],
      center: ["50%", "48%"],
      data: data.map((item) => ({ name: item.label, value: item.count })),
    },
  ],
});

const buildBarOption = (title, data) => ({
  backgroundColor: "transparent",
  color: ["#2563eb"],
  title: { text: title, left: 16, top: 12, textStyle: { color: "#e2e8f0", fontSize: 14 } },
  tooltip: { trigger: "axis", backgroundColor: "rgba(15,23,42,0.94)", borderColor: "rgba(148,163,184,0.18)" },
  grid: { left: 48, right: 24, top: 64, bottom: 56 },
  xAxis: {
    type: "category",
    data: data.map((item) => item.label),
    axisLabel: { color: "#94a3b8", interval: 0, rotate: data.length > 4 ? 18 : 0 },
  },
  yAxis: { type: "value", axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "rgba(148,163,184,0.2)" } } },
  series: [{ type: "bar", data: data.map((item) => item.count), barMaxWidth: 34 }],
});

const AuditReportPage = () => {
  const location = useLocation();
  const reportItem = useMemo(
    () => AUDIT_REPORT_ITEMS.find((item) => item.path === location.pathname),
    [location.pathname]
  );
  const reportId = reportItem?.id;
  const reportType = REPORT_TYPE_BY_ID[reportId];
  const copy = REPORT_COPY[reportId] ?? {};

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasExecuted, setHasExecuted] = useState(false);
  const [page, setPage] = useState(1);

  useDocumentTitle(reportItem?.name ?? "Reporte de Auditoría");

  const usesClientProject = EXTERNAL_REPORTS.has(reportId);
  const usesEntityType = !EXTERNAL_REPORTS.has(reportId) && !SESSION_REPORTS.has(reportId) && !SENDMAIL_REPORTS.has(reportId);

  const columns = useMemo(() => [
    { key: "date", label: "Fecha", sortable: true, render: (row) => formatDateTime(row.date), exportValue: (row) => formatDateTime(row.date) },
    { key: "actor", label: "Actor", sortable: true },
    { key: "action", label: "Acción", sortable: true },
    ...(usesEntityType ? [{ key: "entityType", label: "Entidad", sortable: true }] : []),
    {
      key: "status",
      label: "Estado",
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
      exportValue: (row) => getStatusMeta(row.status).label,
    },
    { key: "subject", label: "Sujeto", sortable: true },
    { key: "detail", label: "Detalle", cellClassName: "min-w-[260px]" },
    { key: "ip", label: "IP", sortable: true },
    ...(usesClientProject ? [
      { key: "client", label: "Cliente", sortable: true },
      { key: "project", label: "Proyecto", sortable: true },
    ] : []),
    { key: "count", label: "Total", sortable: true },
  ], [usesClientProject, usesEntityType]);

  const sorters = useMemo(() => ({
    date: (row) => row.date,
    actor: (row) => row.actor,
    action: (row) => row.action,
    entityType: (row) => row.entityType,
    status: (row) => getStatusMeta(row.status).label,
    subject: (row) => row.subject,
    ip: (row) => row.ip,
    client: (row) => row.client,
    project: (row) => row.project,
    count: (row) => row.count,
  }), []);

  const { sortedItems, sortConfig, toggleSort } = useTableSorting(rows, sorters);
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / ITEMS_PER_PAGE));
  const pagedRows = sortedItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const statusDistribution = useMemo(() => buildStatusDistribution(rows), [rows]);
  const actionDistribution = useMemo(() => buildActionDistribution(rows), [rows]);
  const uniqueActors = useMemo(() => new Set(rows.map((row) => row.actor).filter(Boolean)).size, [rows]);
  const uniqueEntities = useMemo(() => new Set(rows.map((row) => row.entityType).filter(Boolean)).size, [rows]);
  const evidenceCount = useMemo(() => rows.reduce((total, row) => total + (Number(row.count) || 1), 0), [rows]);

  const summaryCards = useMemo(() => [
    { label: "Eventos visibles", value: formatNumber(rows.length), helper: "Registros resultantes del filtro aplicado.", icon: "FaClipboardCheck", tone: "sky" },
    { label: "Actores", value: formatNumber(uniqueActors), helper: "Usuarios, invitados o sistema representados.", icon: "FaUserShield", tone: "emerald" },
    { label: "Entidades", value: formatNumber(uniqueEntities), helper: "Tipos de objeto con evidencia en el reporte.", icon: "FaDatabase", tone: "amber" },
    { label: GROUPED_REPORTS.has(reportId) ? "Eventos agregados" : "Evidencias", value: formatNumber(evidenceCount), helper: "Suma base para revisión o agrupación.", icon: "FaChartBar", tone: "violet" },
  ], [evidenceCount, reportId, rows.length, uniqueActors, uniqueEntities]);

  const actorOptions = useMemo(
    () => buildSelectOptions(rows.map((row) => row.actor), filters.actor),
    [filters.actor, rows]
  );

  const filterFields = useMemo(() => {
    const fields = [
      { name: "dateFrom", label: "Desde", type: "date", icon: "FaCalendarAlt" },
      { name: "dateTo", label: "Hasta", type: "date", icon: "FaCalendarAlt" },
      {
        name: "actor",
        label: "Actor",
        type: "select",
        icon: "FaUser",
        placeholder: "Todos los actores",
        options: actorOptions,
      },
    ];

    if (usesEntityType) {
      fields.push({
        name: "entityType",
        label: "Entidad",
        type: "select",
        icon: "FaDatabase",
        placeholder: "Todas las entidades",
        options: ENTITY_TYPE_OPTIONS,
      });
    }

    fields.push({
      name: "status",
      label: "Estado",
      type: "select",
      icon: "FaFilter",
      placeholder: "Todos los estados",
      options: STATUS_OPTIONS,
    });

    if (usesClientProject) {
      fields.push(
        { name: "client", label: "Cliente", type: "text", icon: "FaBuilding", placeholder: "Filtrar cliente" },
        { name: "project", label: "Proyecto", type: "text", icon: "FaLayerGroup", placeholder: "Filtrar proyecto" }
      );
    }

    return fields;
  }, [actorOptions, usesClientProject, usesEntityType]);

  const defaultVisibleFilters = useMemo(() => ({
    ...DEFAULT_VISIBLE_FILTERS,
    actor: true,
    status: false,
    client: false,
    project: false,
    entityType: false,
  }), [usesClientProject, usesEntityType]);

  const loadReport = useCallback(async (nextFilters) => {
    if (!reportType) return;
    setIsLoading(true);
    try {
      const response = await listAuditEvents({
        reportType,
        dateFrom: nextFilters.dateFrom,
        dateTo: nextFilters.dateTo,
        actor: nextFilters.actor,
        entityType: usesEntityType ? nextFilters.entityType : null,
        status: nextFilters.status,
        client: usesClientProject ? nextFilters.client : null,
        project: usesClientProject ? nextFilters.project : null,
        limit: 500,
      });
      setRows((response?.items ?? []).map(normalizeRow));
      setHasExecuted(true);
      setPage(1);
    } catch (error) {
      reportLog.error(`No se pudo cargar el reporte de auditoría ${reportId}.`, error);
      setRows([]);
      setHasExecuted(true);
    } finally {
      setIsLoading(false);
    }
  }, [reportId, reportType, usesClientProject, usesEntityType]);

  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setRows([]);
    setHasExecuted(false);
    setPage(1);
  }, [reportId]);

  const handleFilterChange = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    loadReport(filters);
  };

  const handleExportSpreadsheet = () => {
    const csv = buildCsv(columns, sortedItems);
    downloadTextFile(`${reportId || "reporte-auditoria"}.csv`, csv, "text/csv;charset=utf-8");
  };

  const handleExportPdf = async () => {
    const payload = {
      template_key: "executive_summary_general",
      report_key: reportId || "reporte-auditoria",
      report_type: "Reporte de Auditoría",
      report_title: reportItem?.name ?? "Reporte de Auditoría",
      report_description: reportItem?.description ?? copy.tableDescription,
      report_objective: `Entregar evidencia trazable para ${safeText(reportItem?.name, "auditoría").toLowerCase()} según los filtros aplicados.`,
      source_module: "Módulo de Reportes",
      orientation: "landscape",
      paper_size: "A4",
      applied_filters: Object.entries(appliedFilters)
        .filter(([, value]) => String(value ?? "").trim())
        .map(([key, value]) => ({ label: key, value })),
      summary_metrics: summaryCards.map((card) => ({
        label: card.label,
        value: String(card.value),
        helper: card.helper,
      })),
      chart_data: {
        status_distribution: statusDistribution.map((item) => ({ label: item.label, count: item.count })),
        client_activity: actionDistribution.map((item) => ({ label: item.label, count: item.count })),
      },
      table_title: "Detalle de evidencia exportada",
      table_description: copy.tableDescription ?? "Detalle tabular del reporte de auditoría.",
      table_range_label: `${formatNumber(sortedItems.length)} fila(s) exportada(s)`,
      table_columns: columns.map((column) => ({ key: column.key, label: column.label })),
      table_rows: sortedItems.map((row) =>
        columns.reduce((accumulator, column) => {
          accumulator[column.key] = column.exportValue ? column.exportValue(row) : row[column.key] ?? "-";
          return accumulator;
        }, {})
      ),
    };
    const pdfBlob = await previewReportPdfBlob(payload);
    openPdfViewer({
      title: `PDF - ${reportItem?.name ?? "Reporte de Auditoría"}`,
      filename: `${reportId || "reporte-auditoria"}.pdf`,
      blob: pdfBlob,
    });
  };

  if (!reportType) {
    return (
      <ReportModulePage
        icon="FaShield"
        title="Reporte de auditoría no disponible"
        description="La ruta solicitada no corresponde a un reporte de auditoría activo."
        filterFields={[]}
        columns={columns}
        rows={[]}
      />
    );
  }

  return (
    <ReportModulePage
      icon={copy.icon ?? "FaShield"}
      title={reportItem?.name ?? "Reporte de Auditoría"}
      description={reportItem?.description ?? copy.tableDescription}
      filterFields={filterFields}
      defaultVisibleFilters={defaultVisibleFilters}
      filterValues={filters}
      onFilterChange={handleFilterChange}
      onApplyFilters={handleApplyFilters}
      isApplyDisabled={isLoading}
      applyLabel={isLoading ? "Cargando reporte..." : "Filtrar / Ejecutar"}
      resultsTitle="Resultados del reporte"
      onExportPdf={handleExportPdf}
      onExportSpreadsheet={handleExportSpreadsheet}
      isExportDisabled={isLoading || sortedItems.length === 0}
      summaryCards={summaryCards}
      afterSummaryContent={hasExecuted ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/70">
            <AsyncEChart option={buildDonutOption("Distribución por estado", statusDistribution)} style={{ height: 320, width: "100%" }} />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/70">
            <AsyncEChart option={buildBarOption("Actividad por acción", actionDistribution)} style={{ height: 320, width: "100%" }} />
          </div>
        </section>
      ) : null}
      columns={columns}
      rows={pagedRows}
      getRowKey={(row) => row.id}
      sortConfig={sortConfig}
      onSort={toggleSort}
      page={page}
      totalPages={totalPages}
      totalItems={sortedItems.length}
      itemsPerPage={ITEMS_PER_PAGE}
      onPageChange={setPage}
      emptyTitle={
        isLoading
          ? "Cargando reporte"
          : hasExecuted
            ? "Sin evidencia para mostrar"
            : "Reporte sin ejecutar"
      }
      emptyMessage={
        isLoading
          ? "Consultando la fuente de auditoría."
          : hasExecuted
            ? "Ajusta los filtros o verifica si existen eventos para este reporte."
            : "Define los filtros y presiona Filtrar / Ejecutar para generar la data."
      }
    />
  );
};

export default AuditReportPage;
