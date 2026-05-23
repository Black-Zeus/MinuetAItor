/**
 * sidebarConfig.js
 * Configuración centralizada de módulos del sidebar
 */

const buildReportSections = (sections = []) =>
  sections.map((section, sectionIndex) => ({
    ...section,
    order: sectionIndex + 1,
    items: (section.items ?? []).map((item, itemIndex) => ({
      ...item,
      order: itemIndex + 1,
      sectionId: section.id,
      sectionName: section.name,
      sectionDescription: section.description ?? "",
    })),
  }));

const flattenReportSections = (sections = []) =>
  sections.flatMap((section) => section.items.map((item) => ({
    ...item,
    sectionId: section.id,
    sectionName: section.name,
    sectionDescription: section.description ?? "",
  })));

export const GESTION_REPORT_SECTIONS = buildReportSections([
  {
    id: "gestion-executive",
    name: "Resumen Ejecutivo",
    description: "Visión consolidada para gerencia sobre actividad documental, clientes, proyectos y flujo general.",
    items: [
      { id: "gestion-executive-general", name: "Resumen Ejecutivo General", description: "Consolida volumen de minutas, backlog, clientes y actividad global del período.", icon: "FaGaugeHigh", path: "/reports/management/executive-summary-general" },
      { id: "gestion-executive-client", name: "Resumen Ejecutivo por Cliente", description: "Resume actividad documental, revisión y uso de IA agrupado por cliente.", icon: "FaBuilding", path: "/reports/management/executive-summary-client" },
      { id: "gestion-executive-project", name: "Resumen Ejecutivo por Proyecto", description: "Muestra la actividad documental y operativa asociada a cada proyecto.", icon: "FaDiagramProject", path: "/reports/management/executive-summary-project" },
    ],
  },
  {
    id: "gestion-minutes",
    name: "Producción de Minutas",
    description: "Seguimiento operativo del ciclo documental de las minutas y sus estados.",
    items: [
      { id: "gestion-minute-production", name: "Producción de Minutas", description: "Mide cuántas minutas ingresan, avanzan y se publican en el flujo general.", icon: "FaFileLines", path: "/reports/management/minute-production" },
      { id: "gestion-minute-status", name: "Minutas por Estado", description: "Distribuye las minutas según su estado actual dentro del proceso.", icon: "FaClipboardList", path: "/reports/management/minutes-by-status" },
      { id: "gestion-minute-author", name: "Minutas por Elaborador", description: "Compara la carga documental y producción por usuario responsable.", icon: "FaUser", path: "/reports/management/minutes-by-author" },
      { id: "gestion-minute-client", name: "Minutas por Cliente", description: "Identifica qué clientes concentran mayor volumen de minutas.", icon: "FaBuilding", path: "/reports/management/minutes-by-client" },
      { id: "gestion-minute-project", name: "Minutas por Proyecto", description: "Agrupa el volumen documental de minutas por proyecto.", icon: "FaLayerGroup", path: "/reports/management/minutes-by-project" },
      { id: "gestion-minute-cycle", name: "Tiempos de Ciclo de Minutas", description: "Analiza cuánto tarda una minuta en recorrer el flujo hasta su publicación.", icon: "FaClock", path: "/reports/management/minute-cycle-times" },
      { id: "gestion-minute-reprocess", name: "Minutas con Reproceso", description: "Detecta minutas que fallaron o necesitaron reintentos de procesamiento.", icon: "FaArrowsRotate", path: "/reports/management/minutes-with-reprocess" },
    ],
  },
  {
    id: "gestion-commitments",
    name: "Requerimientos y Compromisos",
    description: "Seguimiento documental de acuerdos, compromisos declarados y requerimientos extraídos desde las minutas.",
    items: [
      { id: "gestion-agreements-followup", name: "Seguimiento Documental de Acuerdos", description: "Lista acuerdos declarados y su estado registrado en las minutas.", icon: "FaListCheck", path: "/reports/management/agreements-document-followup" },
      { id: "gestion-commitments-expired", name: "Compromisos con Fecha Expirada", description: "Resalta compromisos cuya fecha declarada ya venció en el registro documental.", icon: "FaTriangleExclamation", path: "/reports/management/expired-commitments" },
      { id: "gestion-commitments-owner", name: "Compromisos por Responsable", description: "Agrupa compromisos declarados según la persona asignada.", icon: "FaUsers", path: "/reports/management/commitments-by-owner" },
      { id: "gestion-requirements-priority", name: "Requerimientos por Prioridad", description: "Ordena requerimientos según prioridad y estado registrado.", icon: "FaThumbtack", path: "/reports/management/requirements-by-priority" },
      { id: "gestion-requirements-client", name: "Requerimientos y Compromisos por Cliente", description: "Resume seguimiento documental agrupado por cliente.", icon: "FaBuilding", path: "/reports/management/requirements-commitments-by-client" },
      { id: "gestion-requirements-project", name: "Requerimientos y Compromisos por Proyecto", description: "Resume seguimiento documental agrupado por proyecto.", icon: "FaLayerGroup", path: "/reports/management/requirements-commitments-by-project" },
    ],
  },
  {
    id: "gestion-review",
    name: "Revisión y Publicación",
    description: "Control editorial del flujo de revisión, observaciones externas y publicación final.",
    items: [
      { id: "gestion-review-minutes", name: "Minutas en Revisión", description: "Muestra las minutas que hoy se encuentran en etapa de revisión.", icon: "FaClipboardCheck", path: "/reports/management/minutes-in-review" },
      { id: "gestion-review-observations", name: "Observaciones Externas Recibidas", description: "Centraliza observaciones ingresadas por participantes externos.", icon: "FaCommentAlt", path: "/reports/management/external-observations-received" },
      { id: "gestion-review-resolution", name: "Resolución de Observaciones", description: "Resume cómo se están resolviendo las observaciones editoriales.", icon: "FaCheck", path: "/reports/management/observation-resolution" },
      { id: "gestion-review-friction", name: "Minutas con Mayor Fricción de Revisión", description: "Detecta minutas con más iteraciones o fricción antes de publicarse.", icon: "FaTriangleExclamation", path: "/reports/management/minutes-review-friction" },
      { id: "gestion-publications-finished", name: "Publicaciones Finalizadas", description: "Lista minutas que alcanzaron publicación final y su fecha asociada.", icon: "FaRegFile", path: "/reports/management/completed-publications" },
      { id: "gestion-review-mails", name: "Correos de Revisión y Publicación", description: "Monitorea correos vinculados al flujo editorial de revisión y cierre.", icon: "FaEnvelope", path: "/reports/management/review-publication-emails" },
    ],
  },
  {
    id: "gestion-context",
    name: "Clientes y Proyectos",
    description: "Reportería contextual sobre clientes y proyectos como agrupadores documentales.",
    items: [
      { id: "gestion-client-portfolio", name: "Cartera de Clientes", description: "Describe clientes activos y su volumen de actividad documental asociada.", icon: "FaBuilding", path: "/reports/management/client-portfolio" },
      { id: "gestion-project-portfolio", name: "Cartera de Proyectos", description: "Describe proyectos activos y su nivel de actividad documental.", icon: "FaDiagramProject", path: "/reports/management/project-portfolio" },
      { id: "gestion-client-inactive", name: "Clientes sin Actividad Documental Reciente", description: "Identifica clientes sin minutas recientes para seguimiento.", icon: "FaClockRotateLeft", path: "/reports/management/clients-without-recent-document-activity" },
      { id: "gestion-project-inactive", name: "Proyectos sin Actividad Documental Reciente", description: "Identifica proyectos con baja o nula actividad documental reciente.", icon: "FaClockRotateLeft", path: "/reports/management/projects-without-recent-document-activity" },
      { id: "gestion-client-load", name: "Clientes con Mayor Carga Documental", description: "Prioriza clientes que concentran más minutas, revisión o uso de IA.", icon: "FaChartBar", path: "/reports/management/clients-with-highest-document-load" },
      { id: "gestion-project-load", name: "Proyectos con Mayor Carga Documental", description: "Prioriza proyectos con mayor intensidad documental y operativa.", icon: "FaChartBar", path: "/reports/management/projects-with-highest-document-load" },
    ],
  },
  {
    id: "gestion-ai",
    name: "Uso y Costo de IA",
    description: "Uso funcional, rendimiento, costos y errores asociados a los modelos y providers de IA.",
    items: [
      { id: "gestion-ai-usage", name: "Uso General de IA", description: "Resume consumo, volumen y rendimiento general del uso de IA.", icon: "FaRobot", path: "/reports/management/general-ai-usage" },
      { id: "gestion-ai-cost-client", name: "Costo de IA por Cliente", description: "Estima el costo de IA imputado a cada cliente.", icon: "FaChartPie", path: "/reports/management/ai-cost-by-client" },
      { id: "gestion-ai-cost-project", name: "Costo de IA por Proyecto", description: "Estima el costo de IA imputado a cada proyecto.", icon: "FaChartPie", path: "/reports/management/ai-cost-by-project" },
      { id: "gestion-ai-cost-model", name: "Costo de IA por Modelo", description: "Compara costo estimado entre los modelos utilizados.", icon: "FaBrain", path: "/reports/management/ai-cost-by-model" },
      { id: "gestion-ai-cost-provider", name: "Costo de IA por Proveedor", description: "Compara costo y volumen entre providers o adapters de IA.", icon: "FaDatabase", path: "/reports/management/ai-cost-by-provider" },
      { id: "gestion-ai-latency-model", name: "Latencia y Éxito por Modelo", description: "Mide desempeño técnico y tasa de éxito por modelo.", icon: "FaChartLine", path: "/reports/management/ai-latency-success-by-model" },
      { id: "gestion-ai-profile-usage", name: "Uso de IA por Perfil", description: "Muestra qué perfiles de análisis IA se usan con mayor frecuencia.", icon: "FaBrain", path: "/reports/management/ai-usage-by-profile" },
      { id: "gestion-ai-errors", name: "Eventos IA con Error", description: "Centraliza errores, timeouts y cancelaciones del flujo IA.", icon: "FaTriangleExclamation", path: "/reports/management/ai-error-events" },
    ],
  },
  {
    id: "gestion-platform",
    name: "Salud Operativa",
    description: "Visión de colas, backlog, fallos, reintentos y alertas relevantes para la operación diaria.",
    items: [
      { id: "gestion-queue-status", name: "Estado de Colas", description: "Muestra carga, umbrales y estado operativo de las colas del sistema.", icon: "FaGears", path: "/reports/management/queue-status" },
      { id: "gestion-backlog", name: "Backlog Operacional", description: "Resume acumulación de trabajo y riesgo de demora operativa.", icon: "FaClipboardList", path: "/reports/management/operational-backlog" },
      { id: "gestion-processing-failures", name: "Fallos de Procesamiento", description: "Detecta transacciones fallidas y patrones de error en el flujo.", icon: "FaBug", path: "/reports/management/processing-failures" },
      { id: "gestion-recovery", name: "Reprocesos y Recuperación", description: "Revisa flujos que requirieron reintentos y su resultado.", icon: "FaArrowsRotate", path: "/reports/management/reprocess-and-recovery" },
      { id: "gestion-provider-validation", name: "Validación de Providers IA", description: "Controla el estado de validación de providers y sus últimos errores.", icon: "FaShield", path: "/reports/management/ai-provider-validation" },
      { id: "gestion-system-alerts", name: "Alertas del Sistema", description: "Consolida alertas operativas relevantes para la plataforma.", icon: "FaBell", path: "/reports/management/system-alerts" },
    ],
  },
  {
    id: "gestion-tags",
    name: "Etiquetas y Tendencias",
    description: "Agrupación temática de minutas, etiquetas operacionales y tendencias detectadas por IA.",
    items: [
      { id: "gestion-minute-tags", name: "Minutas por Tag", description: "Distribuye minutas según etiquetas funcionales u operacionales.", icon: "FaTags", path: "/reports/management/minutes-by-tag" },
      { id: "gestion-ai-tags", name: "Tags AI Detectados", description: "Muestra las etiquetas sugeridas por IA con mayor presencia.", icon: "FaTags", path: "/reports/management/detected-ai-tags" },
      { id: "gestion-ai-tag-conversion", name: "Conversión AI Tag -> Tag Operacional", description: "Evalúa cómo se transforman tags IA en etiquetas operacionales.", icon: "FaCodeBranch", path: "/reports/management/ai-tag-to-operational-tag-conversion" },
      { id: "gestion-topic-trends", name: "Tendencias Temáticas", description: "Detecta crecimiento o concentración de temas tratados en minutas.", icon: "FaChartPie", path: "/reports/management/topic-trends" },
    ],
  },
]);

export const AUDIT_REPORT_SECTIONS = buildReportSections([
  {
    id: "audit-access",
    name: "Accesos y Sesiones",
    description: "Trazabilidad de sesiones, accesos, dispositivos y comportamientos anómalos.",
    items: [
      { id: "audit-user-sessions", name: "Sesiones de Usuario", description: "Lista sesiones activas y cerradas con sus metadatos de acceso.", icon: "FaClockRotateLeft", path: "/reports/audit/user-sessions" },
      { id: "audit-remote-session-close", name: "Cierres Remotos de Sesión", description: "Registra revocaciones manuales o administrativas de sesiones.", icon: "FaUserShield", path: "/reports/audit/remote-session-closes" },
      { id: "audit-device-location-access", name: "Accesos por Dispositivo y Ubicación", description: "Agrupa accesos por origen, dispositivo y ubicación registrada.", icon: "FaDesktop", path: "/reports/audit/device-location-access" },
      { id: "audit-session-anomalies", name: "Anomalías Básicas de Sesión", description: "Destaca comportamientos atípicos definidos para revisión manual.", icon: "FaTriangleExclamation", path: "/reports/audit/basic-session-anomalies" },
    ],
  },
  {
    id: "audit-security",
    name: "Seguridad y Eventos Sensibles",
    description: "Evidencia asociada a identidad, credenciales y acciones relevantes de cuenta.",
    items: [
      { id: "audit-password-changes", name: "Cambios de Password", description: "Consolida cambios de credenciales realizados por usuarios o administración.", icon: "FaKey", path: "/reports/audit/password-changes" },
      { id: "audit-sensitive-account-events", name: "Eventos Sensibles de Cuenta", description: "Agrupa acciones críticas relacionadas con cuenta, identidad y credenciales.", icon: "FaShield", path: "/reports/audit/sensitive-account-events" },
      { id: "audit-available-activity", name: "Actividad de Auditoría Disponible", description: "Muestra la cobertura actual de eventos auditados en la plataforma.", icon: "FaClipboardCheck", path: "/reports/audit/available-audit-activity" },
      { id: "audit-sensitive-user-events", name: "Eventos Sensibles por Usuario", description: "Agrupa actividad crítica por usuario para revisión de control.", icon: "FaUserShield", path: "/reports/audit/sensitive-user-events" },
    ],
  },
  {
    id: "audit-external-access",
    name: "Acceso Externo a Minutas",
    description: "Trazabilidad de OTP, sesiones de invitados y evidencia generada por accesos externos.",
    items: [
      { id: "audit-minute-otp-requests", name: "Solicitudes OTP para Acceso a Minutas", description: "Registra solicitudes de códigos OTP para accesos externos a minutas.", icon: "FaEnvelope", path: "/reports/audit/minute-otp-requests" },
      { id: "audit-guest-sessions", name: "Sesiones de Invitados", description: "Consolida sesiones emitidas a participantes externos de revisión.", icon: "FaUsers", path: "/reports/audit/guest-sessions" },
      { id: "audit-external-observations-evidence", name: "Observaciones Externas como Evidencia", description: "Presenta observaciones externas desde una óptica de evidencia y trazabilidad.", icon: "FaCommentAlt", path: "/reports/audit/external-observations-evidence" },
      { id: "audit-external-access-by-minute", name: "Accesos Externos por Minuta", description: "Resume qué minutas tuvieron acceso externo y su actividad asociada.", icon: "FaRegFileLines", path: "/reports/audit/external-access-by-minute" },
    ],
  },
  {
    id: "audit-changes",
    name: "Cambios Auditados",
    description: "Agrupación de cambios disponibles por entidad, actor y período.",
    items: [
      { id: "audit-available-change-log", name: "Cambios Auditados Disponibles", description: "Expone los cambios que hoy cuentan con cobertura efectiva de auditoría.", icon: "FaCodeBranch", path: "/reports/audit/available-audited-changes" },
      { id: "audit-changes-by-entity", name: "Cambios por Entidad", description: "Agrupa eventos auditados por tipo de entidad afectada.", icon: "FaClipboardList", path: "/reports/audit/changes-by-entity" },
      { id: "audit-changes-by-actor", name: "Cambios por Actor", description: "Agrupa eventos auditados según el usuario que ejecutó la acción.", icon: "FaUser", path: "/reports/audit/changes-by-actor" },
      { id: "audit-changes-by-period", name: "Cambios por Período", description: "Permite revisar actividad auditada en ventanas temporales.", icon: "FaCalendar", path: "/reports/audit/changes-by-period" },
    ],
  },
  {
    id: "audit-governance",
    name: "Sistema y Gobierno",
    description: "Reportes de control sobre eventos de sistema y trazabilidad con foco de auditoría.",
    items: [
      { id: "audit-system-events", name: "Eventos de Sistema Relevantes", description: "Consolida eventos del sistema con valor para control y revisión.", icon: "FaGears", path: "/reports/audit/relevant-system-events" },
      { id: "audit-control-alerts", name: "Alertas con Impacto de Control", description: "Filtra alertas operativas que requieren mirada de auditoría o gobierno.", icon: "FaTriangleExclamation", path: "/reports/audit/control-impact-alerts" },
      { id: "audit-provider-traceability", name: "Trazabilidad de Providers IA", description: "Muestra validaciones, cambios y errores de providers desde control.", icon: "FaDatabase", path: "/reports/audit/ai-provider-traceability" },
      { id: "audit-system-sendmail", name: "Correos del Sistema", description: "Registra correos emitidos por el sistema, estado de entrega, adjuntos y evidencia asociada.", icon: "FaEnvelope", path: "/reports/audit/system-sendmail" },
    ],
  },
]);

export const GESTION_REPORT_ITEMS = flattenReportSections(GESTION_REPORT_SECTIONS);
export const AUDIT_REPORT_ITEMS = flattenReportSections(AUDIT_REPORT_SECTIONS);

export const SIDEBAR_MODULES = [
  {
    id: "dashboard",
    name: "Inicio",
    icon: "FaHouse",
    path: "/dashboard",
    section: "core",
    order: 1,
  },
  {
    id: "minutes",
    name: "Minutas",
    icon: "FaRegFileLines",
    path: "/minutes",
    section: "core",
    order: 2,
  },
  {
    id: "clients",
    name: "Clientes",
    icon: "FaBuilding",
    path: "/clients",
    section: "management",
    order: 3,
  },
  {
    id: "projects",
    name: "Proyectos",
    icon: "FaLayerGroup",
    path: "/projects",
    section: "management",
    order: 4,
  },
  {
    id: "team",
    name: "Equipo",
    icon: "FaUsers",
    path: "/teams",
    section: "management",
    order: 5,
    requiresAdmin: true,
  },
  {
    id: "participants",
    name: "Participantes",
    icon: "FaUser",
    path: "/participants",
    section: "management",
    order: 6,
  },
  {
    id: "metrics",
    name: "Métricas",
    icon: "FaChartLine",
    path: "/analytics/metrics",
    section: "intelligence",
    order: 7,
  },
  {
    id: "reports-management",
    name: "Reportes de Gestión",
    icon: "FaRegFile",
    path: "/reports/management",
    section: "intelligence",
    order: 8,
  },
  {
    id: "reports-audit",
    name: "Reportes de Auditoría",
    icon: "FaClipboardCheck",
    path: "/reports/audit",
    section: "intelligence",
    order: 9,
  },
  {
    id: "tags",
    name: "Etiquetas",
    icon: "FaTags",
    path: "/settings/tags",
    section: "config",
    order: 10,
  },
  {
    id: "profiles",
    name: "Perfiles AI",
    icon: "FaBrain",
    path: "/settings/profiles",
    section: "config",
    order: 11,
  },
  {
    id: "organization",
    name: "Organización",
    icon: "FaBuilding",
    path: "/settings/organization",
    section: "config",
    order: 12,
    requiresAdmin: true,
  },
  {
    id: "system",
    name: "Sistema",
    icon: "FaGears",
    path: "/settings/system",
    section: "config",
    order: 13,
    requiresAdmin: true,
  },
];

export const SIDEBAR_SECTIONS = {
  core: {
    id: "core",
    title: "Principal",
    order: 1,
    color: "primary",
  },
  management: {
    id: "management",
    title: "Gestión",
    order: 2,
    color: "blue",
  },
  intelligence: {
    id: "intelligence",
    title: "Análisis",
    order: 3,
    color: "purple",
  },
  config: {
    id: "config",
    title: "Configuración",
    order: 4,
    color: "gray",
  },
};

/**
 * Filtra módulos según permisos del usuario (soporta children)
 */
export const filterModulesByPermissions = (modules = SIDEBAR_MODULES, user = {}) => {
  const filterRecursively = (items = []) =>
    items
      .filter((module) => {
        if (module.requiresAdmin && !user.isAdmin) return false;
        return true;
      })
      .map((module) => {
        if (Array.isArray(module.children) && module.children.length > 0) {
          const children = filterRecursively(module.children);
          return { ...module, children };
        }
        return module;
      })
      .filter((module) => {
        const hasChildren = Array.isArray(module.children) && module.children.length > 0;
        if (!module.path && !hasChildren) return false;
        return true;
      });

  return filterRecursively(modules);
};
