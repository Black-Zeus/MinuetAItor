# Iteracion 02 - Auditoria PRD Sistema >> Mantenimiento

Fecha: 2026-05-29

Alcance: revision estatica del codigo. No se ejecutaron contenedores, pruebas, jobs ni consultas runtime.

## Resumen ejecutivo

El submodulo tiene una base funcional razonable: configuracion singleton, endpoints ADMIN, tick interno protegido con secreto, lock Redis, colas Redis, worker con reintentos/DLQ, SSE y UI con polling de respaldo. Antes de PRD hay riesgos relevantes en atomicidad de encolado, trazabilidad historica, operaciones destructivas de temporales, semantica incompleta de limpieza de sesiones, alertas de cola dependientes de estado JSON singleton y controles operativos con mezcla DB/archivo marcador.

Bloqueantes sugeridos antes de PRD:

- Alto: encolado Redis y commit DB no son atomicos; puede quedar job en cola sin runtime marcado o runtime marcado sin evento.
- Alto: `cleanup_temp_files` borra recursivamente bajo `TRACE_BASE_DIR` sin allowlist, dry-run ni proteccion contra path mal configurado.
- Alto: modo operativo depende de archivo marcador como fuente prioritaria; no se evidencia reconciliacion robusta si DB y archivo divergen.
- Medio/Alto: limpieza de sesiones no distingue antiguedad, tipo de sesion ni tolerancia ante perdida temporal de Redis.
- Medio/Alto: no hay historial persistente de ejecuciones; solo ultimo estado por rutina.

## 1. Arquitectura general

Resumen actual:

- UI llama `/v1/system/maintenance`, `/status`, `/operation-state`, `/run/*` y `/events`.
- Backend concentra configuracion y tick en `system_maintenance_service.py`.
- Scheduler llama endpoint interno cada minuto.
- Worker consume `queue:maintenance` y actualiza runtime.
- SSE publica eventos `events:system:maintenance`.

Hallazgo A1

- Severidad: Medio.
- Evidencia: `APP/volumes/backend/app/services/system_maintenance_service.py`, `_enqueue_maintenance_job`, lineas 952-966; `run_system_maintenance_tick`, lineas 1152-1234.
- Comportamiento: el backend encola en Redis y despues marca runtime/commit DB.
- Impacto: si Redis `rpush` ocurre y luego falla DB, queda job vivo sin estado consistente; si DB se marca y falla publicacion SSE, UI puede requerir polling para converger.
- Recomendacion: introducir una tabla/job ledger o patron outbox para registrar intencion y estado de dispatch.
- Propuesta de correccion: crear `system_maintenance_runs` con `job_id`, `action`, `slot`, `trigger`, `status`; insertar en DB y luego despachar con reconciliacion idempotente.
- Pruebas sugeridas: simular fallo DB despues de `rpush`; simular fallo Redis antes de `rpush`; verificar reconciliacion y no duplicidad.

Hallazgo A2

- Severidad: Medio.
- Evidencia: `APP/volumes/backend/app/services/system_maintenance_service.py`, `_build_runtime_status`, lineas 568-576; SQL `system_maintenance_settings`, lineas 29-43.
- Comportamiento: solo existe ultimo estado por rutina.
- Impacto: troubleshooting productivo queda limitado; no hay auditoria historica de ejecuciones, duracion, errores por intento ni actor.
- Recomendacion: persistir historial de ejecuciones.
- Propuesta de correccion: tabla `system_maintenance_run_events` o `system_maintenance_runs` con estado por transicion.
- Pruebas sugeridas: ejecutar dos rutinas seguidas y verificar que ambas quedan consultables.

## 2. Modo operativo del sitio

Resumen actual:

- Modos: `normal`, `read_only`, `maintenance`, `commissioning`.
- La UI permite cambiar modo con motivo.
- Backend escribe DB y archivo marcador.
- Middleware bloquea escrituras segun archivo marcador.
- Endpoint publico expone estado operativo.

Hallazgo M1

- Severidad: Alto.
- Evidencia: `system_maintenance_service.py`, `_read_operation_marker` y prioridad del marker, lineas 216-264; `main.py`, `maintenance_marker_read_only_middleware`, lineas 122-176.
- Comportamiento: si existe archivo marcador, domina sobre DB.
- Impacto: divergencia entre DB y archivo puede dejar el sistema bloqueado o liberado incorrectamente; el origen puede ser dificil de auditar.
- Recomendacion: definir una unica fuente de verdad o reconciliacion explicita.
- Propuesta de correccion: hacer DB fuente primaria y generar marker derivado con version/hash; al iniciar, validar consistencia y emitir alerta si difiere.
- Pruebas sugeridas: DB normal con marker maintenance; DB maintenance sin marker; marker corrupto; verificar respuesta HTTP y UI.

Hallazgo M2

- Severidad: Medio.
- Evidencia: `system_maintenance_service.py`, `set_system_operation_mode`, lineas 367-503.
- Comportamiento: el cambio de modo escribe marker antes de `db.commit()` en modo restringido, y limpia marker antes de `db.commit()` al volver a normal.
- Impacto: si falla commit, marker y DB pueden quedar inconsistentes.
- Recomendacion: ordenar cambios con compensacion o transaccion logica.
- Propuesta de correccion: commit DB primero, luego escribir/limpiar marker; si falla marker, registrar estado degradado y devolver error operacional.
- Pruebas sugeridas: forzar error de escritura de marker; forzar error de commit; validar rollback.

Hallazgo M3

- Severidad: Bajo.
- Evidencia: `schemas/system_maintenance.py`, `SystemOperationModeRequest`, lineas 186-198.
- Comportamiento: `reason` es opcional y no tiene largo maximo backend.
- Impacto: payloads largos podrian degradar DB, logs o UI; la UI exige motivo para modos restringidos, pero backend no.
- Recomendacion: validar motivo en backend.
- Propuesta de correccion: `reason: str | None = Field(None, max_length=500)` y requerirlo para modos no `normal`.
- Pruebas sugeridas: POST sin motivo, motivo vacio y motivo >500.

## 3. Solicitudes de alta

Resumen actual:

- Campo `access_request_enabled` vive en `system_maintenance_settings`.
- Login consulta `/v1/auth/access-request/status`.
- Creacion de solicitud valida `is_access_request_enabled`.

Hallazgo S1

- Severidad: Bajo.
- Evidencia: `access_request_service.py`, `is_access_request_enabled`, lineas 27-38.
- Comportamiento: si la tabla no existe o falla consulta, retorna `False`; si no hay singleton, retorna `True`.
- Impacto: comportamiento de fail-open parcial cuando no existe fila; puede habilitar solicitudes por defecto sin decision explicita.
- Recomendacion: definir politica PRD: fail-closed o bootstrap explicito.
- Propuesta de correccion: exigir singleton creado por bootstrap o devolver `False` si no existe fila en entornos PRD.
- Pruebas sugeridas: tabla inexistente, fila inexistente, campo `0/1`.

Hallazgo S2

- Severidad: Medio.
- Evidencia: `routers/v1/auth.py`, endpoints publicos, lineas 68-79; `access_request_service.py`, creacion referenciada lineas 187+ por busqueda.
- Comportamiento: el endpoint de solicitud es publico.
- Impacto: riesgo de spam operacional si no hay rate limit/CAPTCHA especifico. No evidenciado en los archivos revisados.
- Recomendacion: aplicar rate limit por IP/email y control anti-abuso.
- Propuesta de correccion: integrar middleware/rate limiter por endpoint y deduplicacion temporal por email.
- Pruebas sugeridas: multiples solicitudes por IP y por email; verificar 429/deduplicacion.

## 4. Limpieza de sesiones

Resumen actual:

- Worker consulta todas las sesiones con `logged_out_at IS NULL`.
- Verifica existencia de clave Redis `session:{user_id}:{jti}`.
- Si no existe en Redis, marca `logged_out_at` salvo `archive_only`.

Hallazgo L1

- Severidad: Alto.
- Evidencia: `maintenance_handler.py`, `_handle_cleanup_sessions`, lineas 182-235.
- Comportamiento: no filtra por antiguedad ni tolerancia; cualquier sesion activa sin clave Redis se cierra.
- Impacto: una caida o limpieza temporal de Redis puede cerrar sesiones validas masivamente.
- Recomendacion: agregar ventana de gracia y criterio de edad/actividad.
- Propuesta de correccion: cerrar solo sesiones cuyo `updated_at/created_at` supere umbral configurable y confirmar ausencia Redis en dos ticks.
- Pruebas sugeridas: Redis vacio con sesiones recientes; sesiones antiguas; modo `archive_only`; verificar conteos.

Hallazgo L2

- Severidad: Medio.
- Evidencia: `maintenance_handler.py`, lineas 182-235.
- Comportamiento: `soft_logout` y `revoke_idle` actualizan la misma columna `logged_out_at`; solo cambia mensaje.
- Impacto: la UI comunica estrategias distintas que no se traducen en comportamiento distinto evidenciado.
- Recomendacion: alinear semantica o simplificar opciones.
- Propuesta de correccion: implementar revocacion real adicional para `revoke_idle` o eliminar esa opcion.
- Pruebas sugeridas: comparar efectos DB de ambos modos.

Hallazgo L3

- Severidad: Medio.
- Evidencia: `maintenance_handler.py`, lineas 194-231.
- Comportamiento: carga todas las sesiones abiertas y ejecuta pipeline completo.
- Impacto: en PRD con muchas sesiones puede ser costoso y bloquear worker.
- Recomendacion: paginar/batchear.
- Propuesta de correccion: procesar por lotes con limite configurable y cursor por id.
- Pruebas sugeridas: dataset grande; medir tiempo, memoria y concurrencia.

## 5. Limpieza de temporales

Resumen actual:

- Worker toma `TRACE_BASE_DIR`, recorre recursivamente archivos y borra los antiguos a `max_age_days`.
- Luego intenta borrar directorios vacios.

Hallazgo T1

- Severidad: Alto.
- Evidencia: `maintenance_handler.py`, `_handle_cleanup_temp_files`, lineas 238-271.
- Comportamiento: borrado recursivo directo bajo `settings.TRACE_BASE_DIR`.
- Impacto: si `TRACE_BASE_DIR` esta mal configurado o apunta a ruta compartida, puede borrar archivos no deseados.
- Recomendacion: validar raiz permitida, dry-run y allowlist de subdirectorios.
- Propuesta de correccion: rechazar `/`, `/app`, volumenes no esperados; operar solo en subcarpetas conocidas; registrar detalle.
- Pruebas sugeridas: `TRACE_BASE_DIR` inexistente, raiz peligrosa, symlinks, archivos recientes/antiguos.

Hallazgo T2

- Severidad: Medio.
- Evidencia: `maintenance_handler.py`, lineas 251-266.
- Comportamiento: ignora `FileNotFoundError` y `OSError` en directorios, pero no registra archivos fallidos por permisos.
- Impacto: puede reportar exito parcial sin saber que quedo pendiente.
- Recomendacion: contar errores y reportarlos en runtime.
- Propuesta de correccion: agregar `failed_count` y mensaje con resumen; opcionalmente nivel `warning`.
- Pruebas sugeridas: archivo sin permisos; directorio ocupado; validar estado warning.

## 6. Scheduler y cron

Resumen actual:

- Scheduler APScheduler corre en `America/Santiago`.
- `maintenance_tick` corre cada minuto en segundo 0.
- Backend evalua cron de 5 campos localmente.

Hallazgo C1

- Severidad: Medio.
- Evidencia: `scheduler.py`, lineas 111-136; `system_maintenance_service.py`, `_cron_matches`, lineas 933-945.
- Comportamiento: hay doble capa de programacion: scheduler cada minuto y cron propio en backend.
- Impacto: correcto conceptualmente, pero requiere pruebas de cambios DST para `America/Santiago`.
- Recomendacion: cubrir DST y saltos horarios.
- Propuesta de correccion: tests unitarios con fechas de cambio horario y documentar semantica.
- Pruebas sugeridas: cron `0 0 * * *`, `0 3 * * *`, dias de cambio DST.

Hallazgo C2

- Severidad: Bajo.
- Evidencia: `schemas/system_maintenance.py`, validacion cron, lineas 59-81.
- Comportamiento: no soporta alias cron ni nombres de meses/dias.
- Impacto: menor; puede ser aceptable si la UI lo comunica.
- Recomendacion: documentar formato soportado.
- Propuesta de correccion: ayuda UI/backend con ejemplos validos.
- Pruebas sugeridas: expresiones con rangos, pasos, listas y alias rechazados.

## 7. Lock Redis e idempotencia

Resumen actual:

- Lock Redis `lock:system:maintenance:tick` con TTL 90 segundos y `nx`.
- Si no toma lock, tick retorna `tick_locked`.
- Idempotencia por `last_*_enqueued_slot`.

Hallazgo I1

- Severidad: Alto.
- Evidencia: `system_maintenance_service.py`, lock lineas 118-145; slot lineas 1152-1190; commit lineas 1231-1234.
- Comportamiento: el slot se actualiza en DB despues de `rpush`.
- Impacto: si el proceso cae despues de encolar y antes de commit, el siguiente tick puede reencolar el mismo slot.
- Recomendacion: idempotencia por job key unica.
- Propuesta de correccion: guardar `slot+action` con constraint unico antes del dispatch; worker debe ignorar duplicados ya completados/en curso.
- Pruebas sugeridas: matar proceso despues de `rpush`; reintentar tick mismo minuto.

Hallazgo I2

- Severidad: Medio.
- Evidencia: `system_maintenance_service.py`, `_acquire_tick_lock`, lineas 118-133.
- Comportamiento: si Redis falla al tomar lock, retorna como lock no tomado, no como error.
- Impacto: caidas Redis pueden quedar invisibles en scheduler salvo por ausencia de efectos.
- Recomendacion: distinguir `lock_busy` de `lock_error`.
- Propuesta de correccion: devolver razon diferenciada y emitir log/alerta operacional.
- Pruebas sugeridas: Redis timeout vs lock ocupado.

## 8. Colas Redis y worker

Resumen actual:

- Worker consume `queue:minutes`, `queue:email`, `queue:maintenance` por BLPOP.
- `queue:maintenance` tiene handlers `cleanup_sessions` y `cleanup_temp_files`.
- Reintenta con backoff y manda a DLQ al agotar.

Hallazgo W1

- Severidad: Medio.
- Evidencia: `queues/__init__.py`, prioridad lineas 36-40; `worker.py`, BLPOP lineas 122-148.
- Comportamiento: mantenimiento comparte worker con minutas/email y tiene prioridad baja.
- Impacto: bajo carga de minutas o email, mantenimiento puede demorarse, incluyendo limpiezas manuales.
- Recomendacion: evaluar worker dedicado o prioridad configurable.
- Propuesta de correccion: cola/worker dedicado para mantenimiento operativo o separacion de ejecuciones manuales.
- Pruebas sugeridas: cola de minutas saturada y ejecucion manual de mantenimiento.

Hallazgo W2

- Severidad: Medio.
- Evidencia: `maintenance_handler.py`, actualizacion runtime lineas 49-97; `worker.py`, reintentos lineas 73-95.
- Comportamiento: cada intento fallido marca runtime `error`; luego el worker reintenta.
- Impacto: UI puede mostrar error aunque aun existan reintentos pendientes.
- Recomendacion: representar estado `retrying` o intento actual.
- Propuesta de correccion: incluir `attempt`, `max_attempts` y estado intermedio.
- Pruebas sugeridas: handler que falla una vez y luego pasa; verificar UI/runtime.

## 9. Monitoreo de colas y alertas

Resumen actual:

- Backend evalua `LLEN` de colas definidas en catalogo.
- Si `size >= threshold` y no habia alerta activa, crea notificacion in-app y email a ADMIN.
- Estado de alerta queda en `queue_monitor_state_json`.

Hallazgo Q1

- Severidad: Medio.
- Evidencia: `system_maintenance_service.py`, `_process_queue_observability`, lineas 819-872.
- Comportamiento: estado de alerta activo queda en JSON singleton.
- Impacto: si el JSON se corrompe o se pierde, puede reenviar alertas; no hay historial ni auditoria por cola.
- Recomendacion: persistir eventos de alerta por cola.
- Propuesta de correccion: tabla `system_queue_alert_state` con una fila por cola y timestamps.
- Pruebas sugeridas: JSON corrupto; alerta activa; recuperacion; reinicio backend.

Hallazgo Q2

- Severidad: Medio.
- Evidencia: `system_maintenance_service.py`, email alerta lineas 730-753 y recuperacion lineas 794-816.
- Comportamiento: excepciones de email se silencian y solo retornan `False`.
- Impacto: falla de correo no queda visible para operador.
- Recomendacion: registrar warning estructurado y exponer ultimo fallo.
- Propuesta de correccion: guardar `last_alert_mail_error` en estado o logs estructurados.
- Pruebas sugeridas: SMTP caido; plantilla faltante; verificar notificacion in-app y registro.

Hallazgo Q3

- Severidad: Bajo.
- Evidencia: `system_queue_catalog.py`, definiciones lineas 3-64.
- Comportamiento: `queue:pdf` es monitoreada por backend pero consumida por `pdf-worker`; no se reviso handler de `pdf-worker` en esta auditoria.
- Impacto: monitoreo puede ser correcto, pero capacidad real del consumidor queda no evidenciada.
- Recomendacion: auditar `pdf-worker` por separado.
- Propuesta de correccion: agregar chequeo de actividad por consumidor, no solo `LLEN`.
- Pruebas sugeridas: `pdf-worker` detenido con cola vacia/no vacia.

## 10. SSE y actualizacion de UI

Resumen actual:

- Backend publica en Redis `events:system:maintenance`.
- Endpoint SSE requiere ADMIN.
- Conexion se recicla cada 55 segundos y manda keepalive.
- Frontend escucha eventos y dispara refresh de estado.

Hallazgo E1

- Severidad: Medio.
- Evidencia: `system_maintenance_events_service.py`, headers lineas 28-33.
- Comportamiento: `Access-Control-Allow-Origin: *` en SSE.
- Impacto: aunque usa bearer, en PRD conviene alinear CORS con origen permitido.
- Recomendacion: usar configuracion CORS por entorno.
- Propuesta de correccion: derivar header desde `settings.cors_allowed_origins` o removerlo si gateway lo maneja.
- Pruebas sugeridas: origen permitido y no permitido.

Hallazgo E2

- Severidad: Bajo.
- Evidencia: `system_maintenance_events_service.py`, recycle lineas 155-173; frontend hook lineas 97-134.
- Comportamiento: backend recicla a 55s; frontend usa utilidad de EventStream autorizada, pero comportamiento de reconexion no fue evidenciado aqui.
- Impacto: perdida temporal de eventos si reconexion no es robusta.
- Recomendacion: validar reconexion y confiar en polling como fallback.
- Propuesta de correccion: documentar/revisar `authorizedEventStream` y emitir estado visible si SSE cae.
- Pruebas sugeridas: cortar SSE, reciclar servidor, verificar polling y reconexion.

## 11. Frontend y experiencia operativa

Resumen actual:

- UI tiene modo borrador, validacion cron, confirmaciones, run-now bloqueado si hay cambios sin guardar, polling fallback.
- Muestra estado operativo, runtime y umbrales.

Hallazgo F1

- Severidad: Medio.
- Evidencia: `SystemSettingsMaintenancePanel.jsx`, polling fallback lineas 531-543.
- Comportamiento: si SSE esta conectado no hay polling.
- Impacto: si SSE queda conectado pero pierde mensajes por Pub/Sub, UI puede no refrescar hasta accion manual.
- Recomendacion: polling liviano aun con SSE para estado critico.
- Propuesta de correccion: mantener polling lento cada 60-120s aunque SSE este conectado.
- Pruebas sugeridas: publicar evento perdido; verificar convergencia por polling.

Hallazgo F2

- Severidad: Bajo.
- Evidencia: `SystemSettingsMaintenancePanel.jsx`, run-now lineas 445-489.
- Comportamiento: boton indica "Ejecutando..." solo mientras se encola, no mientras worker ejecuta.
- Impacto: operador podria creer que termino cuando solo fue encolado.
- Recomendacion: separar estados "Encolando" y runtime "En ejecucion".
- Propuesta de correccion: deshabilitar o mostrar estado por `job_id` hasta terminal.
- Pruebas sugeridas: job lento; verificar textos y disabled states.

Hallazgo F3

- Severidad: Bajo.
- Evidencia: `systemMaintenanceService.js`, `runReadiness`, lineas 152-160; router backend `run_readiness_endpoint`, lineas 137-145.
- Comportamiento: frontend `runReadiness()` usa GET `/readiness`, no POST `/readiness/run`.
- Impacto: si se espera una accion de ejecucion diferenciada, no se usa. Puede ser intencional, pero no evidenciado.
- Recomendacion: alinear contrato.
- Propuesta de correccion: cambiar frontend a POST o remover endpoint duplicado.
- Pruebas sugeridas: ejecutar boton de readiness y revisar metodo HTTP.

## 12. Base de datos y persistencia

Resumen actual:

- `system_maintenance_settings` es singleton `id=1`.
- Guarda configuracion, umbrales, estado JSON de alertas y ultimo runtime.
- `SystemOperationState` se importa desde modelo de backups.

Hallazgo B1

- Severidad: Medio.
- Evidencia: SQL `20260517_1910...`, lineas 6-52; `system_maintenance_service.py`, `_get_singleton`, lineas 516-538.
- Comportamiento: si no existe singleton, backend lo crea con defaults.
- Impacto: defaults pueden habilitar tareas automaticas sin aprobacion explicita en PRD.
- Recomendacion: bootstrap controlado por seed/migracion.
- Propuesta de correccion: crear fila inicial en SQL con valores PRD revisados; en PRD no autocrear con tareas activas.
- Pruebas sugeridas: DB vacia en PRD mode; validar estado inicial.

Hallazgo B2

- Severidad: Medio.
- Evidencia: `system_maintenance_service.py`, `EXPECTED_SYSTEM_MAINTENANCE_COLUMNS`, lineas 69-88; `_require_schema`, lineas 180-190.
- Comportamiento: valida columnas esperadas, pero no tipos, indices, constraints ni tabla de operation state.
- Impacto: drift parcial de esquema podria pasar.
- Recomendacion: ampliar validacion de compatibilidad.
- Propuesta de correccion: chequeo de tipos/nullability o migracion formal.
- Pruebas sugeridas: columna con tipo incorrecto; columna faltante; FK rota.

## 13. Seguridad y control de acceso

Resumen actual:

- Endpoints de configuracion, estado, run-now y SSE requieren ADMIN.
- Tick interno requiere `x-internal-secret`.
- Estado operativo publico no requiere auth.
- Middleware bloquea escrituras segun marker.

Hallazgo G1

- Severidad: Medio.
- Evidencia: `routers/internal/maintenance.py`, dependencia `verify_internal_secret`, lineas 11-15; `scheduler.py`, secret por env/file lineas 20-33 y uso lineas 38-50.
- Comportamiento: control interno depende de secreto compartido. No se evidencio rotacion, audiencia ni allowlist de red en estos archivos.
- Impacto: si se filtra secreto, tick podria dispararse externamente si ruta es alcanzable.
- Recomendacion: restringir por red/gateway y rotacion.
- Propuesta de correccion: validar origen interno adicional y auditar intentos fallidos.
- Pruebas sugeridas: llamada sin secreto, secreto invalido, desde origen no esperado.

Hallazgo G2

- Severidad: Medio.
- Evidencia: `operationModeGuard.js`, lineas 94-109.
- Comportamiento: si falla consulta de modo operativo, frontend permite escritura (`return true`).
- Impacto: si backend tambien falla abierto en alguna ruta, podria permitir cambios; backend middleware es la defensa principal.
- Recomendacion: frontend deberia fallar cerrado para acciones sensibles.
- Propuesta de correccion: retornar `false` ante error o pedir confirmacion admin.
- Pruebas sugeridas: endpoint operation-state caido; intentar accion de escritura.

Hallazgo G3

- Severidad: Bajo.
- Evidencia: `routers/v1/system_maintenance.py`, endpoint publico lineas 97-105.
- Comportamiento: estado operativo publico expone modo, motivo, inicio y actor si viene del estado.
- Impacto: informacion operacional puede ser sensible dependiendo del despliegue.
- Recomendacion: revisar si `startedBy` y `reason` deben ser publicos.
- Propuesta de correccion: respuesta publica reducida: `mode`, mensaje generico y source opcional.
- Pruebas sugeridas: modo maintenance con motivo sensible; validar payload publico.

## 14. Observabilidad, logs y troubleshooting

Resumen actual:

- Scheduler loguea tick OK/error.
- Worker loguea inicio/completado/fallo.
- SSE tiene logs instrumentados.
- Runtime guarda solo ultimo mensaje.

Hallazgo O1

- Severidad: Medio.
- Evidencia: `scheduler.py`, logs lineas 73-87; `worker.py`, logs lineas 61-95; `maintenance_handler.py`, logs lineas 296-378.
- Comportamiento: logs existen, pero no hay correlacion completa `slot/action/job_id` en todos los puntos.
- Impacto: troubleshooting distribuido requiere buscar manualmente.
- Recomendacion: estandarizar campos estructurados.
- Propuesta de correccion: incluir `job_id`, `scheduled_slot`, `action`, `trigger`, `attempt` en scheduler/backend/worker/SSE.
- Pruebas sugeridas: ejecutar job y reconstruir trazabilidad end-to-end desde logs.

Hallazgo O2

- Severidad: Medio.
- Evidencia: `maintenance_handler.py`, `_notify_admins`, lineas 130-179.
- Comportamiento: se genera notificacion admin para `running`, `success`, `error`.
- Impacto: puede generar ruido operacional en cada ejecucion programada exitosa.
- Recomendacion: notificar solo manual/error o hacer configurable.
- Propuesta de correccion: preferencias por rutina y severidad; agrupar exitos diarios.
- Pruebas sugeridas: cron horario durante 24h; contar notificaciones.

## 15. Pruebas recomendadas antes de PRD

Resumen actual:

- No se evidenciaron tests especificos para este submodulo en los archivos revisados.
- No se ejecutaron pruebas en esta auditoria por restriccion operativa.

Hallazgo P1

- Severidad: Alto.
- Evidencia: no evidenciado en revision estatica de archivos relevantes.
- Comportamiento: no se observaron pruebas unitarias/integracion/e2e especificas para tick, lock, worker, SSE y modo operativo.
- Impacto: alto riesgo de regresion en PRD.
- Recomendacion: crear suite minima antes de PRD.
- Propuesta de correccion: tests unitarios de cron/idempotencia, integracion Redis/DB, e2e UI admin.
- Pruebas sugeridas:
  - Tick cron: due, not_due, already_enqueued.
  - Lock: ocupado, timeout Redis, liberacion correcta.
  - Encolado: Redis OK/KO, DB OK/KO, duplicidad por slot.
  - Worker sesiones: Redis vacio, parcial, archive_only, revoke_idle.
  - Worker temporales: ruta segura, ruta inexistente, permisos, symlinks.
  - Alertas: threshold crossing, recovery, email fail.
  - SSE: auth ADMIN/no ADMIN, reconnect, fallback polling.
  - Modo operativo: normal/read_only/maintenance/commissioning en backend y UI.

## Checklist PRD-ready

Bloqueantes

- [ ] Atomicidad/idempotencia de encolado resuelta o mitigada con ledger/outbox.
- [ ] Limpieza de temporales protegida con rutas seguras, dry-run o allowlist.
- [ ] Limpieza de sesiones con ventana de gracia y semantica real por modo.
- [ ] Reconciliacion DB/marker definida, testeada y observable.
- [ ] Historial minimo de ejecuciones o run ledger disponible para soporte.
- [ ] Pruebas de tick, lock, worker, SSE y modo operativo implementadas.

No bloqueantes, pero recomendados

- [ ] Polling lento de respaldo aun con SSE conectado.
- [ ] Alertas de cola con estado por tabla y errores de email visibles.
- [ ] Rate limit especifico para solicitudes de alta.
- [ ] Validacion backend de `reason` y respuesta publica reducida.
- [ ] Logs estructurados con `job_id`, `slot`, `action`, `trigger`, `attempt`.
- [ ] Notificaciones de exito programado configurables para evitar ruido.
- [ ] Documentacion operacional: como pausar, recuperar, revisar DLQ y validar colas.
