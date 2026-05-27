const TAG_LABELS = {
  auth: "Autenticación",
  security: "Seguridad",
  password: "Contraseña",
  "auth.password.changed": "Contraseña actualizada",
  "auth.password.changed_by_admin": "Contraseña cambiada por administración",
  "auth.password.reset": "Contraseña restablecida",

  minute: "Acta",
  analysis: "Análisis",
  processed: "Procesada",
  failed: "Fallida",
  publication: "Publicación",
  completed: "Completada",
  status: "Estado",
  preview: "En revisión",
  pdf: "PDF",
  draft: "Borrador",
  observation: "Observación",
  guest: "Invitado",
  request: "Solicitud",
  queued: "Encolada",

  "minute.analysis.completed": "Análisis de acta completado",
  "minute.analysis.failed": "Análisis de acta fallido",
  "minute.request.queued": "Solicitud de acta encolada",
  "minute.request.queue_failed": "Solicitud de acta con error de cola",
  "minute.publication.completed": "Publicación de acta completada",
  "minute.status.preview": "Acta enviada a revisión",
  "minute.status.changed": "Cambio de estado de minuta",
  "minute.publication.pdf_ready": "PDF final disponible",
  "minute.conversion.completed": "PDF de borrador disponible",
  "minute.observation.created": "Observación de acta recibida",
  "minute.observation.email.sent": "Correo por observación de acta enviado",
  "minute.observation.email.failed": "Correo por observación de acta con error",
  "minute.observation.inserted": "Observación de acta incorporada",
  "minute.observation.approved": "Observación de acta aprobada",
  "minute.observation.rejected": "Observación de acta rechazada",

  email: "Correo",
  sent: "Enviado",
  "email.failed": "Correo con error",
  "minute.analysis.email.sent": "Correo de acta procesada enviado",
  "minute.analysis.email.failed": "Correo de acta procesada con error",
  "minute.review.email.sent": "Correo de revisión enviado",
  "minute.review.email.failed": "Correo de revisión con error",
  "minute.publication.email.sent": "Correo de publicación enviado",
  "minute.publication.email.failed": "Correo de publicación con error",
  "minute.officialized.email.sent": "Correo de acta oficializada enviado",
  "minute.officialized.email.failed": "Correo de acta oficializada con error",

  acl: "Acceso",
  client: "Cliente",
  project: "Proyecto",
  private: "Privado",
  permission: "Permiso",
  "acl.client.granted": "Acceso a cliente otorgado",
  "acl.client.revoked": "Acceso a cliente revocado",
  "acl.project.granted": "Acceso a proyecto otorgado",
  "acl.project.revoked": "Acceso a proyecto revocado",

  rbac: "Rol",
  role: "Rol",
  "rbac.role.granted": "Rol asignado",
  "rbac.role.changed": "Rol actualizado",
  "rbac.role.revoked": "Rol revocado",

  team: "Cuenta",
  account: "Cuenta",
  access: "Acceso",
  assignment: "Asignación",
  "team.account.created": "Cuenta creada",
  "team.account.activated": "Cuenta activada",
  "team.account.deactivated": "Cuenta desactivada",
  "access.assignment.updated": "Asignación de acceso actualizada",
  "access.client.assigned": "Cliente asignado",
  "access.client.activated": "Acceso base a cliente activado",
  "access.client.revoked": "Acceso base a cliente revocado",
  "access.client.removed": "Cliente desvinculado",

  system: "Sistema",
  queue: "Cola",
  alert: "Alerta",
  recovery: "Recuperación",
  maintenance: "Mantenimiento",
  running: "En ejecución",
  success: "Completada",
  error: "Con error",
  session_cleanup: "Limpieza de sesiones",
  temp_cleanup: "Limpieza de temporales",
  "queue.minutes": "Cola de minutas",
  "queue.email": "Cola de correo",
  "queue.maintenance": "Cola de mantenimiento",
  "queue.pdf": "Cola de PDF",
  "queue.dlq": "Cola DLQ",
  "system.queue.threshold_exceeded": "Cola sobre umbral",
  "system.queue.threshold_recovered": "Cola normalizada",
  "system.maintenance.session_cleanup": "Mantenimiento de sesiones",
  "system.maintenance.temp_cleanup": "Mantenimiento de temporales",
  "system.maintenance.running": "Mantenimiento en ejecución",
  "system.maintenance.success": "Mantenimiento completado",
  "system.maintenance.error": "Mantenimiento con error",
};

const prettifyToken = (value = "") =>
  String(value)
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const getNotificationTagLabel = (tag) => {
  const raw = String(tag || "").trim();
  if (!raw) return "";
  return TAG_LABELS[raw] || prettifyToken(raw);
};

export default TAG_LABELS;
