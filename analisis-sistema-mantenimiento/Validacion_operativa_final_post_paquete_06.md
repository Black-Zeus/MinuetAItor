# Validacion operativa final post Paquete 06

Fecha: 2026-05-29 America/Santiago

Modulo: `Sistema >> Mantenimiento`

Veredicto: **PRD-ready condicionado**

## Resumen ejecutivo

Se ejecuto una validacion operativa posterior a los paquetes 01 a 06. El stack se encuentra arriba, backend y scheduler responden, Redis esta saludable, la tabla `system_maintenance_runs` existe en MariaDB, el scheduler llama `maintenance_tick` cada minuto, el endpoint SSE exige autenticacion y abre stream autenticado, y `/api/internal/*` no queda expuesto por Nginx.

No se declara `PRD-ready` pleno porque quedan validaciones criticas sin evidencia completa: UI real en navegador, recepcion SSE en UI, fallback de polling, escenarios DB/marker A-E, medicion de consultas DB del middleware y confirmacion runtime de la allowlist real de temporales. Ademas, el worker actualmente en ejecucion no tiene cargadas las variables nuevas `MAINTENANCE_TEMP_CLEANUP_*`, por lo que requiere recreacion/redeploy del servicio worker antes de cerrar PRD.

## Validaciones ejecutadas

| Area | Resultado | Evidencia | Estado |
| --- | --- | --- | --- |
| Stack Docker | Servicios principales arriba; backend, MariaDB, Redis, MinIO y Mailpit saludables. | `docker compose -f docker-compose.yml ps` mostro backend `healthy`, Redis `healthy`, MariaDB `healthy`, worker/scheduler/nginx `Up`. | OK |
| Validacion estatica Python | Sin errores de compilacion. | `python3 -m py_compile APP/volumes/backend/app/main.py ... maintenance_handler.py` sin salida y exit code 0. | OK |
| Limpieza de diff | Sin whitespace errors. | `git diff --check` sin salida y exit code 0. | OK |
| Migracion `system_maintenance_runs` | Tabla aplicada con PK, uniques, indices y FK. | `SHOW CREATE TABLE system_maintenance_runs` confirma `uq_smr_job_id`, `uq_smr_correlation_id`, `uq_smr_scheduler_slot_action(action, scheduled_slot, trigger_type)`, indices por estado/accion/usuario. | OK |
| Run ledger | Hay historial de cron y manual. | Ultimos runs: `cleanup_sessions` cron `success`, `cleanup_temp_files` cron `warning`, manual `cleanup_temp_files` `dispatch_error`. | OK |
| Redis queue | Cola vacia al cierre. | `redis-cli LLEN queue:maintenance` = `0`, `LRANGE` sin elementos. | OK |
| Scheduler | Tick de mantenimiento ejecuta cada minuto. | Logs scheduler: `Maintenance tick OK | slot=202605292211...202605292229 | enqueued=- | queue_alerts=0`. | OK |
| Backend | Recibe ticks internos y health internos. | Logs backend: `POST /internal/v1/maintenance/tick HTTP/1.1" 200 OK` repetido. | OK |
| Worker | Arranca y registra colas. | Logs worker: `Worker listo | queues=['queue:minutes', 'queue:email', 'queue:maintenance'] | max_retries=3`. | OK |
| Worker env temporales | Variables nuevas no estan cargadas en el contenedor activo. | `docker compose exec worker env | grep MAINTENANCE_TEMP_CLEANUP` no muestra variables; `TRACE_BASE_DIR` tampoco aparece como env. El codigo tiene defaults, pero no la configuracion operativa esperada. | Warning |
| SSE sin token | Bloqueado. | `GET /api/v1/system/maintenance/events` sin token responde `401` con `No se proporcionó token de autenticación.` | OK |
| SSE con ADMIN | Stream abre. | `curl -i -N --max-time 6 /api/v1/system/maintenance/events` con Bearer ADMIN responde `200 OK`, `Content-Type: text/event-stream; charset=utf-8`, queda abierto hasta timeout de curl. | OK |
| Nginx SSE | Buffering desactivado por config. | `nginx -T`: location `~ ^/api/.*/events$` tiene `proxy_buffering off`, `proxy_cache off`, `proxy_read_timeout 3600s`, `add_header X-Accel-Buffering no`. | OK |
| Header SSE externo | `X-Accel-Buffering` no se observo en la respuesta curl externa, aunque la config Nginx lo declara. | Respuesta externa mostro `Content-Type: text/event-stream` y `cache-control: no-cache`, sin header `X-Accel-Buffering`. | Warning |
| Internal externo | Bloqueado por gateway. | `curl -i http://127.0.0.1/api/internal/v1/maintenance/tick` responde `404 Not Found`; `nginx -T` tiene `location ^~ /api/internal/ { return 404; }`. | OK |
| Estado operativo DB/marker | Estado actual DB restringido y marker ausente. | `system_operation_state.mode=commissioning`, `operation_id=7ee326a6-fb66-48de-ac81-f04961910f1b`; marker `/app/runtime/maintenance_mode.json` ausente. | Warning |
| Middleware optimizado | Correccion presente en codigo, falta medicion de query count. | `main.py` filtra `safe methods`, bypass paths e internal antes de `_effective_operation_marker`; cache TTL en `_OPERATION_STATE_CACHE_TTL_SEC = 3.0`. | Warning |
| UI real | No ejecutada en navegador real. | Sin Playwright/browser ni captura manual en esta corrida. | No ejecutada |
| Polling fallback | No ejecutado en UI real. | No se simulo perdida SSE en navegador. | No ejecutada |
| DB/marker A-E | No ejecutado end-to-end para no alterar el modo operativo actual. | Solo se constato DB `commissioning` + marker ausente. | No ejecutada |

## Hallazgos

### Medio - Worker activo sin variables operativas nuevas de temporales

Evidencia:

- `docker compose exec worker env | grep -E "TRACE_BASE_DIR|MAINTENANCE_TEMP_CLEANUP"` no mostro `TRACE_BASE_DIR`, `MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS`, `MAINTENANCE_TEMP_CLEANUP_DRY_RUN` ni `MAINTENANCE_TEMP_CLEANUP_SAFETY_GRACE_MINUTES`.
- `docker-compose.yml` si contiene `MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS`, `MAINTENANCE_TEMP_CLEANUP_DRY_RUN` y `MAINTENANCE_TEMP_CLEANUP_SAFETY_GRACE_MINUTES`.
- Codigo con defaults: `APP/volumes/worker/app/core/config.py`.

Impacto:

El worker puede operar con defaults de codigo, pero no queda evidenciada la allowlist real por ambiente ni `dry_run=true` como configuracion runtime. Esto impide cerrar PRD para `cleanup_temp_files`.

Correccion sugerida:

Recrear/redeploy del servicio worker con la configuracion actual de compose y volver a ejecutar la validacion de allowlist real desde el contenedor.

### Medio - UI real y polling fallback no validados

Evidencia:

- No se abrio navegador real ni se capturaron logs de consola.
- No se verifico visualmente `dispatch_pending`, `dispatch_error`, bloqueo de doble ejecucion manual ni convergencia por polling.

Impacto:

El codigo frontend contiene soporte visual para `dispatch_pending` y `dispatch_error`, pero la experiencia operativa no esta demostrada end-to-end.

Correccion sugerida:

Ejecutar una sesion manual en navegador contra `http://minuetaitor.vsoto.cl/`, capturar consola, confirmar estados y simular perdida SSE.

### Medio - Escenarios DB/marker no validados end-to-end

Evidencia:

- Estado observado: DB `commissioning` + marker ausente.
- No se recorrieron escenarios A-E: DB normal + marker maintenance, DB maintenance + marker ausente, marker corrupto, DB caida + marker maintenance, DB caida + sin marker.

Impacto:

La politica conservadora esta implementada en codigo, pero no queda evidencia operacional completa para declarar PRD pleno.

Correccion sugerida:

Ejecutar los escenarios A-E en QA, registrar HTTP status para POST/PUT/PATCH/DELETE y GET/HEAD/OPTIONS, y restaurar el modo inicial al terminar.

### Bajo - Header `X-Accel-Buffering` no visible en respuesta externa

Evidencia:

- `nginx -T` declara `proxy_buffering off` y `add_header X-Accel-Buffering no`.
- `curl` externo autenticado mostro `Content-Type: text/event-stream`, pero no mostro `X-Accel-Buffering`.

Impacto:

El stream funciona y Nginx no deberia buferizar por configuracion, pero la evidencia HTTP no muestra el header esperado.

Correccion sugerida:

Revisar si Nginx elimina el header por contexto y, si se requiere evidencia explicita, agregar `always` o validar con un endpoint SSE que emita un primer evento/keepalive antes del timeout.

## Evidencia SQL relevante

`SHOW CREATE TABLE system_maintenance_runs`:

```sql
CREATE TABLE `system_maintenance_runs` (
  `id` char(36) NOT NULL,
  `job_id` char(36) NOT NULL,
  `action` varchar(80) NOT NULL,
  `scheduled_slot` char(12) DEFAULT NULL,
  `trigger_type` varchar(30) NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'dispatch_pending',
  `queued_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `duration_ms` bigint(20) DEFAULT NULL,
  `affected_count` int(11) DEFAULT NULL,
  `attempt` int(11) NOT NULL DEFAULT 1,
  `max_attempts` int(11) NOT NULL DEFAULT 1,
  `message` varchar(700) DEFAULT NULL,
  `error_code` varchar(80) DEFAULT NULL,
  `error_detail` text DEFAULT NULL,
  `requested_by` char(36) DEFAULT NULL,
  `correlation_id` char(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_smr_job_id` (`job_id`),
  UNIQUE KEY `uq_smr_correlation_id` (`correlation_id`),
  UNIQUE KEY `uq_smr_scheduler_slot_action` (`action`,`scheduled_slot`,`trigger_type`),
  KEY `idx_smr_status_updated` (`status`,`updated_at`),
  KEY `idx_smr_action_created` (`action`,`created_at`),
  KEY `idx_smr_requested_by` (`requested_by`),
  CONSTRAINT `fk_smr_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Ultimos runs observados:

```text
cleanup_temp_files | manual | dispatch_error | No se pudo despachar el job a Redis
cleanup_temp_files | cron   | warning        | no existen subdirectorios permitidos bajo /app/assets/temp
cleanup_sessions   | cron   | success        | scanned=0 candidate=0 affected=0 skipped_recent=3
```

## Checklist final

- [x] Migracion `system_maintenance_runs` aplicada en MariaDB.
- [x] Backend inicia sin errores.
- [x] Worker inicia sin errores.
- [x] Scheduler llama tick correctamente.
- [~] Redis recibe job en `queue:maintenance`. Evidenciado en runs previos; al cierre la cola esta vacia y los ticks actuales no encolan por configuracion.
- [x] Worker procesa `queued -> running -> success/warning/error`. Evidenciado por ledger `success`, `warning` y `dispatch_error`; transiciones intermedias no se capturaron en vivo en esta corrida.
- [x] Doble tick del mismo slot no duplica ejecucion. Soportado por constraint unico `uq_smr_scheduler_slot_action`; no reejecutado en caliente en esta corrida.
- [x] Redis caido durante dispatch deja `dispatch_error`.
- [x] `cleanup_sessions` con Redis caido no cierra sesiones. Evidenciado en validacion anterior de handler; no reejecutado en esta corrida.
- [x] `cleanup_sessions archive_only` no modifica sesiones. Evidenciado en validacion anterior de handler; no reejecutado en esta corrida.
- [x] `cleanup_sessions revoke_idle` queda warning sin modificacion destructiva. Evidenciado en validacion anterior de handler; no reejecutado en esta corrida.
- [x] `cleanup_temp_files` probado en dry-run. Evidenciado en validacion anterior de handler; requiere repetir con worker redeployado.
- [~] Allowlist real de temporales confirmada. Compose y `.env` estan configurados, pero el worker activo no tiene env nuevas cargadas.
- [x] Symlink hacia fuera no se elimina. Evidenciado en validacion anterior de handler.
- [ ] DB normal + marker maintenance bloquea mutaciones. No ejecutado.
- [ ] DB maintenance + marker ausente bloquea mutaciones. No ejecutado; estado actual DB `commissioning` + marker ausente requiere prueba HTTP de mutacion.
- [~] Endpoint publico no expone actor ni motivo. Login publico no expone detalle sensible; endpoint publico de estado operativo no fue revalidado completo en esta corrida.
- [x] Frontend build OK. Evidenciado en validacion anterior Docker; no reconstruido despues del ultimo cambio UI.
- [ ] UI bloquea doble ejecucion manual. No ejecutado en navegador real.
- [ ] SSE refresca UI. No ejecutado en navegador real.
- [ ] Si SSE falla, polling converge. No ejecutado.
- [x] Nginx no buferiza SSE. `proxy_buffering off` en config Nginx; header externo no visible.
- [x] Logs contienen `job_id` y `correlation_id`. Evidenciado por logs/ledger de dispatch y runs.
- [~] Middleware optimizado no consulta DB innecesariamente por cada request. Evidencia estatica de filtros/cache; falta medicion de query count.

Leyenda: `[x]` validado, `[~]` parcialmente validado o condicionado, `[ ]` no validado.

## Comandos ejecutados

```bash
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml exec -T redis redis-cli LLEN queue:maintenance
docker compose -f docker-compose.yml exec -T redis redis-cli LRANGE queue:maintenance 0 -1
docker compose -f docker-compose.yml logs --tail=120 worker
docker compose -f docker-compose.yml logs --tail=120 scheduler
docker compose -f docker-compose.yml logs --tail=160 backend
docker compose -f docker-compose.yml exec -T mariadb sh -lc 'mariadb ... SHOW CREATE TABLE system_maintenance_runs ...'
docker compose -f docker-compose.yml exec -T worker sh -lc 'env | grep MAINTENANCE_TEMP_CLEANUP'
curl -i http://127.0.0.1/api/internal/v1/maintenance/tick
curl -i http://127.0.0.1/api/v1/system/maintenance/events
curl -i -N http://127.0.0.1/api/v1/system/maintenance/events -H 'Authorization: Bearer <ADMIN_TOKEN>'
docker compose -f docker-compose.yml exec -T nginx nginx -T
python3 -m py_compile APP/volumes/backend/app/main.py APP/volumes/backend/app/core/config.py APP/volumes/backend/app/services/system_maintenance_service.py APP/volumes/worker/app/handlers/maintenance_handler.py APP/volumes/worker/app/core/config.py
git diff --check
```

## Recomendacion final

Mantener el modulo como **PRD-ready condicionado**. Para promoverlo a **PRD-ready**, cerrar como minimo:

1. Recrear/redeploy del worker y confirmar env `MAINTENANCE_TEMP_CLEANUP_*` en runtime.
2. Validar UI real en navegador y consola.
3. Confirmar SSE actualiza UI y polling converge ante perdida de stream.
4. Ejecutar matriz DB/marker A-E con metodos seguros y mutantes.
5. Medir o instrumentar que GET/HEAD/OPTIONS y rutas exceptuadas no disparan consultas DB innecesarias en el middleware.
