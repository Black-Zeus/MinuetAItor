# Tags de Notificaciones

Este documento resume los tags que hoy puede registrar el sistema en el centro de notificaciones in-app.

Objetivo:
- dejar una referencia funcional y técnica
- facilitar revisión de huecos
- ayudar a mantener consistencia entre productores, backend y frontend

Notas:
- un mismo evento suele registrar varios tags a la vez
- los tags visibles al usuario pasan por el diccionario de [notificationTags.js](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/frontend/src/utils/notificationTags.js:1)
- los tags listados aquí son los actualmente contemplados por productores y presentación
- algunos tags son dinámicos y dependen del estado o rutina

## Tags Base

| Tag técnico | Etiqueta visible | Significado |
| --- | --- | --- |
| `auth` | Autenticación | Evento asociado al dominio de autenticación o seguridad de acceso. |
| `security` | Seguridad | Señal de seguridad o cambio sensible para el usuario. |
| `password` | Contraseña | Evento relacionado con cambio o reseteo de contraseña. |
| `minute` | Acta | Evento vinculado al ciclo de vida de una minuta o acta. |
| `analysis` | Análisis | Proceso de análisis o procesamiento de acta. |
| `processed` | Procesada | Resultado exitoso de procesamiento. |
| `failed` | Fallida | Resultado fallido de procesamiento. |
| `publication` | Publicación | Evento asociado a publicación u oficialización de actas. |
| `completed` | Completada | Tarea completada correctamente. |
| `status` | Estado | Cambio de estado dentro de un flujo. |
| `preview` | En revisión | Estado o salida de revisión previa. |
| `pdf` | PDF | Evento relacionado con render o disponibilidad de PDF. |
| `draft` | Borrador | Salida o artefacto en modo borrador. |
| `observation` | Observación | Observación asociada a una minuta. |
| `guest` | Invitado | Acción originada o resuelta dentro del flujo de invitados. |
| `email` | Correo | Notificación vinculada a envío de email. |
| `sent` | Enviado | Marca de envío realizado. |
| `acl` | Acceso | Cambio de acceso sensible o confidencial. |
| `client` | Cliente | Evento relacionado con cliente. |
| `project` | Proyecto | Evento relacionado con proyecto. |
| `private` | Privado | Recurso de alcance privado o confidencial. |
| `permission` | Permiso | Cambio de permiso, privilegio o capacidad otorgada/revocada. |
| `rbac` | Rol | Evento de perfilamiento por rol. |
| `role` | Rol | Rol asignado, cambiado o revocado. |
| `team` | Cuenta | Evento administrativo sobre cuenta de usuario. |
| `account` | Cuenta | Cambio sobre cuenta, activación o alta. |
| `access` | Acceso | Evento de acceso base o asignación operativa. |
| `assignment` | Asignación | Cambio en la asignación de alcance o cobertura. |
| `queue` | Cola | Evento relacionado con una cola operativa del sistema. |
| `alert` | Alerta | Señal técnica de advertencia o condición anómala. |
| `recovery` | Recuperación | Señal técnica de vuelta a estado normal tras una alerta previa. |
| `system` | Sistema | Evento generado por componentes internos del sistema. |
| `maintenance` | Mantenimiento | Rutina de mantenimiento o housekeeping técnico. |
| `running` | En ejecución | Ejecución en curso. |
| `success` | Completada | Ejecución finalizada correctamente. |
| `error` | Con error | Ejecución finalizada con error. |
| `session_cleanup` | Limpieza de sesiones | Rutina de limpieza técnica de sesiones. |
| `temp_cleanup` | Limpieza de temporales | Rutina de limpieza de archivos temporales. |

## Tags de Evento

| Tag técnico | Etiqueta visible | Significado |
| --- | --- | --- |
| `auth.password.changed` | Contraseña actualizada | El usuario cambió su contraseña desde una sesión autenticada. |
| `auth.password.changed_by_admin` | Contraseña cambiada por administración | Un administrador cambió la contraseña del usuario. |
| `auth.password.reset` | Contraseña restablecida | La contraseña fue restablecida mediante flujo de recuperación o reset. |
| `minute.analysis.completed` | Análisis de acta completado | El procesamiento principal del acta terminó correctamente. |
| `minute.analysis.failed` | Análisis de acta fallido | El procesamiento del acta falló. |
| `minute.publication.completed` | Publicación de acta completada | La minuta fue publicada u oficializada correctamente. |
| `minute.status.preview` | Acta enviada a revisión | La minuta pasó al estado de revisión o preview. |
| `minute.status.changed` | Estado de acta actualizado | La minuta cambió de estado. |
| `minute.publication.pdf_ready` | PDF final disponible | El PDF final de la minuta quedó disponible. |
| `minute.conversion.completed` | PDF de borrador disponible | El PDF borrador fue generado y quedó disponible. |
| `minute.observation.created` | Observación de acta recibida | Un invitado registró una observación sobre la minuta. |
| `minute.observation.inserted` | Observación de acta incorporada | La observación fue incorporada o insertada en la minuta. |
| `minute.observation.approved` | Observación de acta aprobada | La observación fue aprobada durante la resolución editorial. |
| `minute.observation.rejected` | Observación de acta rechazada | La observación fue rechazada durante la resolución editorial. |
| `minute.analysis.email.sent` | Correo de acta procesada enviado | Se envió correo notificando resultado de procesamiento de acta. |
| `minute.review.email.sent` | Correo de revisión enviado | Se envió correo asociado al ciclo de revisión de minuta. |
| `minute.publication.email.sent` | Correo de publicación enviado | Se envió correo notificando publicación de minuta. |
| `minute.officialized.email.sent` | Correo de acta oficializada enviado | Se envió correo de acta oficializada o publicada definitivamente. |
| `acl.client.granted` | Acceso a cliente otorgado | Se otorgó acceso confidencial o controlado sobre un cliente. |
| `acl.client.revoked` | Acceso a cliente revocado | Se revocó acceso confidencial o controlado sobre un cliente. |
| `acl.project.granted` | Acceso a proyecto otorgado | Se otorgó acceso confidencial o privado sobre un proyecto. |
| `acl.project.revoked` | Acceso a proyecto revocado | Se revocó acceso confidencial o privado sobre un proyecto. |
| `rbac.role.granted` | Rol asignado | A un usuario se le otorgó un rol. |
| `rbac.role.changed` | Rol actualizado | El rol principal o administrativo del usuario fue modificado. |
| `rbac.role.revoked` | Rol revocado | A un usuario se le quitó un rol. |
| `team.account.created` | Cuenta creada | Se creó una cuenta administrativa o interna para un usuario. |
| `team.account.activated` | Cuenta activada | La cuenta del usuario fue activada. |
| `team.account.deactivated` | Cuenta desactivada | La cuenta del usuario fue desactivada. |
| `access.assignment.updated` | Asignación de acceso actualizada | Se modificó el alcance operativo de clientes/proyectos de un usuario. |
| `access.client.assigned` | Cliente asignado | Se otorgó acceso base a un cliente no confidencial. |
| `access.client.activated` | Acceso base a cliente activado | Se reactivó una asignación base de cliente. |
| `access.client.revoked` | Acceso base a cliente revocado | Se desactivó el acceso base a un cliente. |
| `access.client.removed` | Cliente desvinculado | Se eliminó por completo la asignación base del cliente. |
| `queue.minutes` | Cola de minutas | Señala específicamente la cola operativa principal de minutas. |
| `queue.email` | Cola de correo | Señala específicamente la cola operativa de correo. |
| `queue.maintenance` | Cola de mantenimiento | Señala específicamente la cola operativa de mantenimiento. |
| `queue.pdf` | Cola de PDF | Señala específicamente la cola operativa de render PDF. |
| `queue.dlq` | Cola DLQ | Señala específicamente la cola de trabajos fallidos. |
| `system.queue.threshold_exceeded` | Cola sobre umbral | La cola activa superó el umbral configurado y generó alerta operativa. |
| `system.queue.threshold_recovered` | Cola normalizada | La cola volvió a nivel normal después de una saturación previamente notificada. |
| `system.maintenance.session_cleanup` | Mantenimiento de sesiones | Evento de rutina técnica centrado en limpieza de sesiones. |
| `system.maintenance.temp_cleanup` | Mantenimiento de temporales | Evento de rutina técnica centrado en limpieza de temporales. |
| `system.maintenance.running` | Mantenimiento en ejecución | La rutina técnica fue tomada y está corriendo. |
| `system.maintenance.success` | Mantenimiento completado | La rutina técnica terminó correctamente. |
| `system.maintenance.error` | Mantenimiento con error | La rutina técnica terminó con error. |

## Tags Dinámicos

Estos tags no siempre aparecen como catálogo fijo, porque dependen del runtime o del estado real del evento.

| Tag técnico | Etiqueta visible | Significado |
| --- | --- | --- |
| `pending` | Pending | Estado destino dinámico en flujos de minuta. |
| `completed` | Completada | Estado destino dinámico o marca de cierre exitoso. |
| `cancelled` | Cancelled | Estado destino dinámico cuando una minuta u operación se cancela. |
| `session_cleanup` | Limpieza de sesiones | Nombre técnico de rutina emitido por mantenimiento. |
| `temp_cleanup` | Limpieza de temporales | Nombre técnico de rutina emitido por mantenimiento. |
| `running` | En ejecución | Estado runtime emitido por mantenimiento. |
| `success` | Completada | Estado runtime exitoso emitido por mantenimiento. |
| `error` | Con error | Estado runtime con error emitido por mantenimiento. |

Nota:
- algunos estados dinámicos de minuta todavía se presentan con fallback de capitalización automática si no están mapeados explícitamente en frontend

## Lectura Recomendada

Cómo interpretar una notificación:

1. Un tag base indica el dominio general.
2. Un tag de evento identifica la acción exacta.
3. Tags dinámicos pueden complementar contexto de estado o subtipo.

Ejemplo:

- `minute`
- `observation`
- `guest`
- `minute.observation.approved`

Lectura funcional:
- se trata de una minuta
- vinculada a observaciones
- originada o tratada en el flujo de invitados
- con resultado final de observación aprobada

## Fuente de Verdad Técnica

Presentación frontend:
- [notificationTags.js](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/frontend/src/utils/notificationTags.js:1)

Productores backend y workers:
- [auth_service.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/services/auth_service.py:1)
- [internal_minutes_service.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/services/internal_minutes_service.py:1)
- [minutes_service.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/services/minutes_service.py:1)
- [minute_views_service.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/services/minute_views_service.py:1)
- [notification_service.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/services/notification_service.py:1)
- [user_client_acl.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/routers/v1/user_client_acl.py:1)
- [user_project_acl.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/routers/v1/user_project_acl.py:1)
- [user_roles.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/routers/v1/user_roles.py:1)
- [teams.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/routers/v1/teams.py:1)
- [user_clients.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/routers/v1/user_clients.py:1)
- [maintenance_handler.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/worker/app/handlers/maintenance_handler.py:1)

## Observación

Este documento describe el estado actual observado del sistema. Si se agrega un productor nuevo o cambia el diccionario de presentación, este archivo debe actualizarse junto con el código.
