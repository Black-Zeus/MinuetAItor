# Validacion final de integracion - Sistema >> Mantenimiento

Fecha: 2026-05-29  
Alcance: revision estatica posterior a paquetes 01 a 05.  
Modo de validacion: codigo, contratos, referencias cruzadas y compilacion Python local. No se operaron contenedores ni se ejecuto build frontend por regla del repositorio.

## Resumen ejecutivo

El submodulo queda mejor posicionado para PRD que en la auditoria inicial: ahora existe run ledger persistente, intencion antes de Redis, estados visibles de dispatch, worker con transiciones de ejecucion, hardening de limpiezas, reconciliacion DB/marker, SSE con fallback de polling y UI con bloqueo basico de doble ejecucion manual.

No detecte un bloqueante critico por sintaxis o acoplamiento evidente. Si detecte riesgos operativos que deben validarse en Docker antes de PRD: carga adicional del middleware por consulta DB en cada request, posible no-op conservador de limpieza de temporales si no existen subdirectorios allowlist, y validaciones runtime pendientes de MariaDB/Redis/SSE/frontend build.

Veredicto: **PRD-ready condicionado**.

Condicion principal: ejecutar checklist Docker completo, observar comportamiento real bajo Redis/DB activos y corregir los hallazgos Alto/Medio si se confirman en runtime.

## Validaciones realizadas

- Compilacion Python local OK:
  - `APP/volumes/backend/app/main.py`
  - `APP/volumes/backend/app/models/system_maintenance_runs.py`
  - `APP/volumes/backend/app/services/system_maintenance_service.py`
  - `APP/volumes/backend/app/services/system_maintenance_events_service.py`
  - `APP/volumes/backend/app/routers/v1/system_maintenance.py`
  - `APP/volumes/backend/app/schemas/system_maintenance.py`
  - `APP/volumes/worker/app/core/config.py`
  - `APP/volumes/worker/app/handlers/maintenance_handler.py`
- `git diff --check` OK.
- No se ejecuto `docker compose`, `docker exec`, migracion real MariaDB ni build frontend por restricciones operativas del repo.

## Hallazgos por severidad

### Alto - Middleware consulta DB en cada request

Evidencia:
- `APP/volumes/backend/app/main.py:184` define `maintenance_marker_read_only_middleware`.
- `APP/volumes/backend/app/main.py:191` llama `_effective_operation_marker(marker_path)` antes de filtrar metodo, endpoint o necesidad real.
- `APP/volumes/backend/app/main.py:155-158` `_effective_operation_marker` lee marker y luego DB.
- `APP/volumes/backend/app/main.py:133-152` `_read_db_operation_state` abre sesion y consulta `system_operation_state`.

Riesgo de regresion:
- Cada request, incluyendo `GET`, `HEAD`, `OPTIONS` y endpoints no mutantes, puede abrir conexion DB.
- Si MariaDB esta lenta o caida, puede aumentar latencia y generar ruido de logs en todas las rutas.
- El middleware cae conservadoramente a marker si DB falla, pero el costo operativo queda repartido por todo el trafico.

Correccion sugerida:
- Mover la evaluacion efectiva despues de descartar metodos seguros cuando no se requiere header de estado.
- Agregar cache corta/TTL del estado operativo, por ejemplo 2 a 5 segundos.
- Mantener lectura DB-first para mutaciones, pero evitar query por request cuando no hay marker ni modo restringido conocido.

Estado PRD:
- Condicionante. No bloquea despliegue si el volumen de trafico es bajo, pero debe medirse antes de PRD.

### Medio - Limpieza de temporales puede quedar en warning/no-op por allowlist default

Evidencia:
- `APP/volumes/worker/app/core/config.py:44` define `TRACE_BASE_DIR=/app/assets/temp`.
- `APP/volumes/worker/app/core/config.py:46-49` allowlist default: `traces/tmp,render/tmp,uploads/tmp,maintenance/tmp`.
- `APP/volumes/worker/app/handlers/maintenance_handler.py:528-544` cancela con `warning` si no existen subdirectorios permitidos.

Riesgo de regresion:
- Si los temporales reales actuales viven directo bajo `/app/assets/temp` o en otros subdirectorios, la rutina no eliminara nada.
- El cambio es seguro, pero puede sorprender operacionalmente porque la limpieza pasa de borrar por raiz a exigir allowlist existente.

Correccion sugerida:
- Confirmar rutas reales dentro del contenedor worker.
- Ajustar `MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS` en ambiente o crear los subdirectorios esperados.
- Documentar que el warning inicial puede ser esperado hasta configurar allowlist.

Estado PRD:
- No bloqueante si se configura allowlist antes de activar limpieza en PRD.

### Medio - `max_attempts` inicial del backend puede no coincidir con worker

Evidencia:
- `APP/volumes/backend/app/services/system_maintenance_service.py:1067-1069` asigna `max_attempts` desde `settings.WORKER_MAX_RETRIES` con fallback `3`.
- `APP/volumes/worker/app/core/config.py:31-34` el worker lee `WORKER_MAX_RETRIES` como `MAX_RETRIES`.
- `APP/volumes/worker/app/handlers/maintenance_handler.py:143-145` y `APP/volumes/worker/app/handlers/maintenance_handler.py:220-222` actualizan `max_attempts` con el valor real del worker.

Riesgo de regresion:
- Mientras el job esta `dispatch_pending` o `queued`, el ledger puede mostrar `max_attempts=3` aunque el worker tenga otro valor.
- Al iniciar o terminar, el worker corrige el valor.

Correccion sugerida:
- Exponer la misma variable de intentos en backend o persistir `max_attempts` desde una configuracion compartida.
- Alternativa simple: aceptar que `max_attempts` pre-worker es informativo y documentarlo.

Estado PRD:
- No bloqueante. Riesgo de trazabilidad menor.

### Medio - Frontend no validado con build real

Evidencia:
- `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx:445-489` agrega flujo de run-now.
- `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx:527-539` bloquea ejecuciones activas por estado `queued/running`.
- `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx:541-552` configura polling 5s/90s/120s.

Riesgo de regresion:
- No se evidencio build Vite/React real.
- Puede existir warning/lint o incompatibilidad no detectable por revision estatica.

Correccion sugerida:
- Ejecutar build dentro del flujo Docker del usuario.
- Validar manualmente run-now, estado `warning`, perdida de SSE y convergencia por polling.

Estado PRD:
- Condicionante por falta de build/runtime.

### Bajo - Endpoint publico oculta actor/motivo, pero mantiene campos tecnicos

Evidencia:
- `APP/volumes/backend/app/services/system_maintenance_service.py:344-358` `get_public_system_operation_state` retorna `operation_id`, `operation_type`, `started_at` y `source`; fuerza `started_by=None` y `reason=None` salvo inconsistencia.
- `APP/volumes/backend/app/routers/v1/system_maintenance.py:98-106` expone `/operation-state/public` sin rol.

Riesgo de regresion:
- Cumple la intencion de no exponer motivo ni actor.
- Aun expone identificadores tecnicos que podrian no ser necesarios para publico.

Correccion sugerida:
- Si el endpoint sera consumido por usuarios anonimos, evaluar respuesta minima: `mode`, `source` y, opcionalmente, `started_at`.

Estado PRD:
- No bloqueante.

### Bajo - SSE/CORS PRD depende de configuracion externa

Evidencia:
- `APP/volumes/backend/app/services/system_maintenance_events_service.py:29-38` permite wildcard solo en dev; en no-dev solo fija origin si hay exactamente un origen configurado.
- `APP/volumes/backend/app/routers/v1/system_maintenance.py:149-162` usa `StreamingResponse` con headers de SSE.

Riesgo de regresion:
- En PRD con multiples origins, el header explicito no se setea aqui y se depende de `CORSMiddleware`/gateway.
- Puede estar correcto, pero requiere prueba real con navegador.

Correccion sugerida:
- Validar en PRD/QA con navegador que EventSource/autenticacion y CORS funcionen.
- Confirmar que nginx no buferiza SSE.

Estado PRD:
- No bloqueante si se valida con checklist.

## Validacion por area solicitada

### 1. Migracion SQL nueva

Estado encontrado:
- Tabla creada en `APP/data/settings/mariadb/init/20260529_1438_schema_system_maintenance_runs.sql:6-39`.
- Campos requeridos presentes: `id`, `job_id`, `action`, `scheduled_slot`, `trigger_type`, `status`, fechas, metricas, intento, mensajes, errores, actor, correlacion y timestamps.
- Indices/constraints:
  - `uq_smr_job_id` en `APP/data/settings/mariadb/init/20260529_1438_schema_system_maintenance_runs.sql:31`.
  - `uq_smr_scheduler_slot_action` en `APP/data/settings/mariadb/init/20260529_1438_schema_system_maintenance_runs.sql:32`.
  - `uq_smr_correlation_id` en `APP/data/settings/mariadb/init/20260529_1438_schema_system_maintenance_runs.sql:33`.
  - FK `requested_by -> users(id)` en `APP/data/settings/mariadb/init/20260529_1438_schema_system_maintenance_runs.sql:38`.

Hallazgos:
- Sin hallazgos criticos en sintaxis estatica.
- La unicidad con `scheduled_slot NULL` permite multiples manuales, lo que cumple el requisito.

Prueba sugerida:
- Aplicar migracion en MariaDB y ejecutar `SHOW CREATE TABLE system_maintenance_runs`.

### 2. Relacion SQLAlchemy

Estado encontrado:
- Modelo `SystemMaintenanceRun` en `APP/volumes/backend/app/models/system_maintenance_runs.py:9-36`.
- Import agregado en `APP/volumes/backend/app/models/__init__.py:36`.

Hallazgos:
- Modelo coherente con tabla.
- No se evidencio uso de Alembic; se mantiene patron del proyecto con SQL manual.

Prueba sugerida:
- Importar backend dentro del contenedor y ejecutar consulta simple al modelo.

### 3. Backend: runs, dispatch e idempotencia

Estado encontrado:
- Creacion `dispatch_pending` antes de Redis en `APP/volumes/backend/app/services/system_maintenance_service.py:1034-1079`.
- Reuso/idempotencia cron por `action + scheduled_slot + trigger_type` en `APP/volumes/backend/app/services/system_maintenance_service.py:1047-1058`.
- Manejo de `IntegrityError` para carrera en `APP/volumes/backend/app/services/system_maintenance_service.py:1080-1094`.
- Payload con `run_id` y `correlation_id` en `APP/volumes/backend/app/services/system_maintenance_service.py:1097-1108`.
- RPUSH y transicion `queued` en `APP/volumes/backend/app/services/system_maintenance_service.py:1123-1174`.
- `dispatch_error` visible si Redis falla en `APP/volumes/backend/app/services/system_maintenance_service.py:1126-1146`.

Hallazgos:
- Cumple el objetivo base.
- Riesgo bajo por `max_attempts` inicial no necesariamente compartido con worker.

Pruebas sugeridas:
- Forzar tick dos veces en mismo minuto y confirmar una sola fila cron.
- Cortar Redis durante dispatch y confirmar `dispatch_error`.
- Reintentar dispatch posterior y confirmar reuso del mismo run.

### 4. Worker: transiciones y duplicados

Estado encontrado:
- Inicio de run en `APP/volumes/worker/app/handlers/maintenance_handler.py:102-176`.
- Omision de duplicados si `running/success` o intento viejo en `APP/volumes/worker/app/handlers/maintenance_handler.py:152-166`.
- Finalizacion en `APP/volumes/worker/app/handlers/maintenance_handler.py:178-236`.
- Flujo principal con eventos, runtime legacy y notificaciones en `APP/volumes/worker/app/handlers/maintenance_handler.py:623-749`.

Hallazgos:
- Cumple lectura de `correlation_id` y transiciones `running/success/error/warning`.
- La omision de duplicados protege reentregas con mismo `job_id`.

Pruebas sugeridas:
- Inyectar dos veces el mismo payload `job_id` y confirmar una sola ejecucion efectiva.
- Forzar error en handler y confirmar retry con attempt mayor.

### 5. cleanup_temp_files

Estado encontrado:
- Root absoluto y rechazo de rutas peligrosas en `APP/volumes/worker/app/handlers/maintenance_handler.py:479-495`.
- Allowlist relativa en `APP/volumes/worker/app/handlers/maintenance_handler.py:466-476`.
- Validacion de subrutas y symlinks en `APP/volumes/worker/app/handlers/maintenance_handler.py:556-583`.
- Dry-run y conteo de directorios en `APP/volumes/worker/app/handlers/maintenance_handler.py:517-523` y `APP/volumes/worker/app/handlers/maintenance_handler.py:595-599`.
- Warning por parciales en `APP/volumes/worker/app/handlers/maintenance_handler.py:604-614`.

Hallazgos:
- Seguro por defecto.
- Requiere confirmar allowlist real en contenedor.

Pruebas sugeridas:
- Crear archivos antiguos dentro y fuera de allowlist.
- Crear symlink a ruta externa y confirmar que no se elimina.
- Ejecutar dry-run y confirmar contadores sin cambios reales.

### 6. cleanup_sessions

Estado encontrado:
- Redis debe responder antes de cerrar sesiones en `APP/volumes/worker/app/handlers/maintenance_handler.py:390-397`.
- Grace window y batch/max en `APP/volumes/worker/app/handlers/maintenance_handler.py:326-350`.
- Filtro por sesiones antiguas en `APP/volumes/worker/app/handlers/maintenance_handler.py:352-360`.
- `archive_only` no modifica en `APP/volumes/worker/app/handlers/maintenance_handler.py:411-419`.
- `revoke_idle` queda seguro en warning sin modificar por falta de actividad confiable en `APP/volumes/worker/app/handlers/maintenance_handler.py:421-430`.
- `soft_logout` actualiza `logged_out_at` solo sobre elegibles en `APP/volumes/worker/app/handlers/maintenance_handler.py:442-463`.

Hallazgos:
- Cumple criterio conservador: Redis caido no cierra sesiones.
- `revoke_idle` queda como modo no destructivo hasta tener `last_seen` confiable.

Pruebas sugeridas:
- Redis caido: confirmar run `error` y ninguna sesion cerrada.
- Sesiones recientes: confirmar no cierre.
- `archive_only`: confirmar affected `0`.

### 7. DB/marker

Estado encontrado:
- Estado DB-first en servicio en `APP/volumes/backend/app/services/system_maintenance_service.py:318-342`.
- Public endpoint sanitizado en `APP/volumes/backend/app/services/system_maintenance_service.py:344-358`.
- Escritura DB antes de marker en cambio de modo en `APP/volumes/backend/app/services/system_maintenance_service.py:428-442` y bloque posterior de persistencia.
- Middleware usa DB/marker efectivo en `APP/volumes/backend/app/main.py:155-181` y bloquea mutaciones en `APP/volumes/backend/app/main.py:184-235`.

Hallazgos:
- Comportamiento conservador logrado.
- Hallazgo Alto: consulta DB por request completo.

Pruebas sugeridas:
- DB normal + marker restringido: confirmar bloqueo conservador.
- DB restringido + marker ausente: confirmar bloqueo.
- Public endpoint: confirmar que no devuelve actor ni motivo sensible.

### 8. Frontend

Estado encontrado:
- Run-now carga y refresca estado en `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx:445-489`.
- Bloqueo visual por `queued/running` en `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx:527-539`.
- Polling con SSE/fallback en `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx:541-552`.
- Indicador operativo en `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx:1139-1143`.

Hallazgos:
- Logica esperada presente.
- Build no evidenciado.

Pruebas sugeridas:
- Build frontend.
- Ejecutar manualmente limpieza y confirmar boton bloqueado mientras `queued/running`.
- Simular desconexion SSE y confirmar polling.

### 9. SSE/CORS

Estado encontrado:
- Canal `events:system:maintenance` en `APP/volumes/backend/app/services/system_maintenance_events_service.py:20`.
- Headers SSE en `APP/volumes/backend/app/services/system_maintenance_events_service.py:29-38`.
- Stream con keepalive/recycle en `APP/volumes/backend/app/services/system_maintenance_events_service.py:76-266`.
- Endpoint admin en `APP/volumes/backend/app/routers/v1/system_maintenance.py:149-162`.

Hallazgos:
- Dev permite wildcard.
- PRD no fuerza wildcard salvo dev; requiere validar CORS/gateway en runtime.

Pruebas sugeridas:
- Verificar headers con navegador real.
- Confirmar reconexion y fallback polling.

## Checklist final de validacion Docker

> Ejecutar por el usuario dentro de su flujo Docker habitual.

- [ ] Aplicar/recrear DB con `20260529_1438_schema_system_maintenance_runs.sql`.
- [ ] Verificar `SHOW CREATE TABLE system_maintenance_runs`.
- [ ] Confirmar que backend inicia sin error de import/modelo.
- [ ] Confirmar que worker inicia sin error de import/config.
- [ ] Ejecutar `POST /internal/v1/maintenance/tick` con cron que calce.
- [ ] Confirmar una fila `dispatch_pending -> queued` en `system_maintenance_runs`.
- [ ] Confirmar job en `queue:maintenance`.
- [ ] Confirmar worker cambia run a `running -> success` o `warning`.
- [ ] Ejecutar dos ticks en mismo slot y confirmar una sola fila cron por accion.
- [ ] Simular Redis no disponible durante dispatch y confirmar `dispatch_error`.
- [ ] Reintentar tras recuperar Redis y confirmar dispatch idempotente del mismo run.
- [ ] Ejecutar limpieza de sesiones con Redis caido y confirmar que no cambia `logged_out_at`.
- [ ] Ejecutar `archive_only` y confirmar `affected_count=0`.
- [ ] Ejecutar `revoke_idle` y confirmar `warning` sin modificacion destructiva.
- [ ] Validar allowlist de temporales real bajo `TRACE_BASE_DIR`.
- [ ] Probar symlink fuera de allowlist y confirmar que no se elimina.
- [ ] Activar modo `maintenance`, validar bloqueo de POST no autorizado.
- [ ] Validar `read_only` permite rutas consideradas seguras y bloquea mutaciones.
- [ ] Validar `/operation-state/public` no expone actor ni motivo.
- [ ] Abrir frontend, confirmar build y pantalla sin errores de consola.
- [ ] Ejecutar run-now desde UI y confirmar bloqueo de doble ejecucion.
- [ ] Confirmar evento SSE refresca UI.
- [ ] Cortar SSE o bloquear evento y confirmar convergencia por polling.
- [ ] Validar CORS de SSE en PRD/QA sin wildcard inesperado.
- [ ] Revisar logs por `job_id` y `correlation_id`.

## Riesgos residuales

- No hay prueba runtime de MariaDB para sintaxis/constraint real.
- No hay prueba real de Redis RPUSH, BLPOP, pub/sub y retries.
- No hay build frontend ejecutado.
- No hay prueba de carga del middleware DB-first.
- La limpieza de temporales depende de configurar allowlist acorde a rutas reales.
- `revoke_idle` queda deliberadamente no destructivo hasta incorporar actividad confiable de sesion.

## Veredicto

**PRD-ready condicionado**

Condiciones antes de PRD:
- Completar checklist Docker.
- Medir/corregir impacto del middleware que consulta DB por request.
- Confirmar allowlist de temporales.
- Confirmar build frontend y flujo SSE/polling en navegador real.
