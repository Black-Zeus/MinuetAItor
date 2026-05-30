# Paquete 06 - Hardening final y validacion PRD condicionada

Fecha: 2026-05-29  
Modulo: `Sistema >> Mantenimiento`  
Estado: aplicado sobre paquetes 01 a 05.

## Resumen ejecutivo

Se corrigio el hallazgo Alto del middleware de modo operativo: ya no consulta DB para cada request seguro o ruta exceptuada, mantiene evaluacion DB/marker para mutaciones y agrega cache TTL corto en memoria por proceso.

Tambien se reforzo la trazabilidad operativa de `cleanup_temp_files`, se alineo el `max_attempts` inicial del backend con `WORKER_MAX_RETRIES`, se expusieron variables de allowlist/dry-run en compose y se agrego compatibilidad visual defensiva para `dispatch_pending` y `dispatch_error` en frontend.

Veredicto: **PRD-ready condicionado**. Queda condicionado a completar la validacion Docker final y pruebas reales de navegador/SSE.

## Archivos modificados

- `APP/volumes/backend/app/main.py`
- `APP/volumes/backend/app/core/config.py`
- `APP/volumes/backend/app/services/system_maintenance_service.py`
- `APP/volumes/worker/app/handlers/maintenance_handler.py`
- `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx`
- `.env`
- `docker-compose.yml`
- `docker-compose-dev.yml`
- `docker-compose-qa.yml`

## Cambios aplicados

### Middleware operativo

Evidencia:
- `APP/volumes/backend/app/main.py:23`
- `APP/volumes/backend/app/main.py:134`
- `APP/volumes/backend/app/main.py:138`
- `APP/volumes/backend/app/main.py:188`
- `APP/volumes/backend/app/main.py:210`
- `APP/volumes/backend/app/main.py:259`

Cambios:
- Se agrego cache TTL corto de estado efectivo con TTL normal de 3s y TTL de error DB de 1s.
- `GET`, `HEAD`, `OPTIONS`, health/docs/static/assets e internos `/internal/` evitan consulta DB.
- Mutaciones siguen evaluando DB/marker.
- Se limita spam de logs de error DB a una ventana de 30s.
- El endpoint de cambio de modo limpia cache despues de mutaciones sobre `/v1/system/maintenance/operation-state`.

Politica conservadora preservada:
- DB restringida bloquea mutaciones aunque no exista marker.
- DB normal + marker restringido bloquea mutaciones por divergencia conservadora.
- DB caida + marker restringido bloquea mutaciones usando marker fallback.
- DB caida + sin marker no bloquea, con cache corta de error para no generar tormenta de logs.

Nota adicional:
- Se exceptuo `/internal/` del bloqueo operativo para que scheduler/worker/backend interno no queden inutilizados durante `commissioning` o `maintenance`.

### cleanup_temp_files

Evidencia:
- `APP/volumes/worker/app/handlers/maintenance_handler.py:467`
- `APP/volumes/worker/app/handlers/maintenance_handler.py:547`
- `APP/volumes/worker/app/handlers/maintenance_handler.py:618`
- `APP/volumes/worker/app/core/config.py:46`
- `.env:94`
- `docker-compose.yml:245`
- `docker-compose-dev.yml:292`
- `docker-compose-qa.yml:133`

Cambios:
- El warning/no-op ahora muestra `TRACE_BASE_DIR`, allowlist activa y subdirectorios inexistentes.
- El resumen de ejecucion incluye rutas permitidas reales.
- Se mantiene allowlist obligatoria, proteccion de symlinks, rechazo de rutas peligrosas y `dry_run`.
- Se agregaron variables de configuracion en `.env` y compose:
  - `MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS`
  - `MAINTENANCE_TEMP_CLEANUP_DRY_RUN`
  - `MAINTENANCE_TEMP_CLEANUP_SAFETY_GRACE_MINUTES`

### max_attempts

Evidencia:
- `APP/volumes/backend/app/core/config.py:95`
- `APP/volumes/backend/app/services/system_maintenance_service.py:1068`
- `APP/volumes/worker/app/core/config.py:33`
- `APP/volumes/worker/app/handlers/maintenance_handler.py:144`
- `APP/volumes/worker/app/handlers/maintenance_handler.py:221`

Cambios:
- Backend ahora lee `WORKER_MAX_RETRIES` como `worker_max_retries`.
- Worker sigue registrando el valor real al iniciar/finalizar.
- El ledger queda mas consistente desde `dispatch_pending`/`queued`.

### Frontend

Evidencia:
- `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx:32`
- `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx:51`
- `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx:536`
- `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx:550`

Cambios:
- Se agregaron etiquetas/tonos para `dispatch_pending` y `dispatch_error`.
- `dispatch_pending` bloquea doble ejecucion junto con `queued` y `running`.
- Se mantiene polling:
  - rutina activa: 5s
  - SSE conectado sin rutina activa: 90s
  - SSE no conectado: 120s

### SSE/CORS

Sin cambios necesarios.

Evidencia:
- `APP/volumes/backend/app/services/system_maintenance_events_service.py:29`
- `APP/volumes/backend/app/routers/v1/system_maintenance.py:149`

Estado:
- Wildcard solo en dev.
- `X-Accel-Buffering: no` ya existe.
- `StreamingResponse` mantiene `text/event-stream`.
- Autenticacion ADMIN se mantiene.

### Endpoint publico operation-state

Sin cambios necesarios.

Estado:
- No expone `started_by`.
- No expone `reason` salvo mensaje generico ante inconsistencia.
- Mantiene campos tecnicos por compatibilidad del contrato actual.

## Validaciones estaticas ejecutadas

OK:

```bash
python3 -m py_compile \
  APP/volumes/backend/app/main.py \
  APP/volumes/backend/app/core/config.py \
  APP/volumes/backend/app/models/system_maintenance_runs.py \
  APP/volumes/backend/app/services/system_maintenance_service.py \
  APP/volumes/backend/app/services/system_maintenance_events_service.py \
  APP/volumes/backend/app/routers/v1/system_maintenance.py \
  APP/volumes/backend/app/schemas/system_maintenance.py \
  APP/volumes/worker/app/core/config.py \
  APP/volumes/worker/app/handlers/maintenance_handler.py
```

OK:

```bash
git diff --check
```

## Validaciones runtime realizadas

Durante la validacion en caliente posterior a los paquetes 01 a 05 se evidencio:
- Build frontend Docker OK, con warnings de chunking de Vite no bloqueantes.
- `system_maintenance_runs` aplicado en MariaDB.
- Backend y worker iniciaron sin errores.
- Scheduler ejecuto `maintenance_tick`.
- Worker proceso `cleanup_sessions` a `success` y `cleanup_temp_files` a `warning`.
- Redis caido durante dispatch dejo `dispatch_error` en `system_maintenance_runs`.
- `cleanup_sessions` con Redis caido no modifico `logged_out_at`.
- `archive_only` no modifico sesiones.
- `revoke_idle` retorno `warning` sin modificacion destructiva.
- `cleanup_temp_files` en dry-run no elimino archivo ni symlink externo.
- Logs de worker incluyen `job_id` y `correlation_id`.

No se da por cerrada la validacion de navegador/UI real ni escenarios DB/marker completos porque la ejecucion fue interrumpida antes de consolidar toda la evidencia.

## Riesgos residuales

- La cache del middleware es por proceso; si hay multiples replicas, cada una refresca dentro de su TTL.
- Cambio de modo puede tardar hasta 3s en reflejarse en procesos que no recibieron la mutacion directamente.
- `cleanup_temp_files` queda seguro por defecto, pero requiere confirmar allowlist real en cada ambiente.
- `revoke_idle` sigue no destructivo hasta existir `last_seen`/actividad confiable.
- SSE/CORS debe validarse en navegador real detras de Nginx/gateway.

## Checklist Docker final

Base de datos:

```sql
SHOW CREATE TABLE system_maintenance_runs;
SHOW INDEX FROM system_maintenance_runs;
```

Backend/worker/scheduler:

```bash
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f scheduler
```

Redis:

```bash
docker compose exec redis redis-cli LLEN queue:maintenance
docker compose exec redis redis-cli LRANGE queue:maintenance 0 -1
```

Tick interno:

```bash
curl -X POST http://backend:8000/internal/v1/maintenance/tick \
  -H "x-internal-secret: <SECRET>"
```

Ledger:

```sql
SELECT id, job_id, action, scheduled_slot, trigger_type, status,
       queued_at, started_at, finished_at, affected_count, message
FROM system_maintenance_runs
ORDER BY id DESC
LIMIT 20;
```

Validaciones obligatorias:

- [ ] Aplicar/recrear DB con `20260529_1438_schema_system_maintenance_runs.sql`.
- [ ] Confirmar backend inicia sin error de import/modelo.
- [ ] Confirmar worker inicia sin error de import/config.
- [ ] Ejecutar tick que calce con cron.
- [ ] Confirmar fila `dispatch_pending -> queued`.
- [ ] Confirmar job en `queue:maintenance`.
- [ ] Confirmar worker cambia run a `running -> success` o `warning`.
- [ ] Ejecutar dos ticks en mismo slot y confirmar una sola fila cron por accion.
- [ ] Simular Redis no disponible durante dispatch y confirmar `dispatch_error`.
- [ ] Reintentar tras recuperar Redis y confirmar dispatch idempotente.
- [ ] Ejecutar limpieza de sesiones con Redis caido y confirmar que no cambia `logged_out_at`.
- [ ] Ejecutar `archive_only` y confirmar `affected_count=0`.
- [ ] Ejecutar `revoke_idle` y confirmar `warning` sin modificacion destructiva.
- [ ] Validar allowlist real de temporales bajo `TRACE_BASE_DIR`.
- [ ] Probar symlink fuera de allowlist y confirmar que no se elimina.
- [ ] Activar modo `maintenance` y validar bloqueo de POST.
- [ ] Activar modo `read_only` y validar bloqueo de mutaciones.
- [ ] Validar DB normal + marker restringido bloquea mutaciones.
- [ ] Validar DB restringida + marker ausente bloquea mutaciones.
- [ ] Validar `/operation-state/public` sin actor ni motivo sensible.
- [ ] Confirmar build frontend.
- [ ] Abrir frontend y confirmar pantalla sin errores de consola.
- [ ] Ejecutar run-now desde UI y confirmar bloqueo de doble ejecucion.
- [ ] Confirmar evento SSE refresca UI.
- [ ] Cortar SSE o bloquear evento y confirmar convergencia por polling.
- [ ] Validar CORS de SSE en PRD/QA sin wildcard inesperado.
- [ ] Confirmar que Nginx no buferiza SSE.
- [ ] Revisar logs por `job_id` y `correlation_id`.
- [ ] Medir que el middleware ya no consulta DB por cada request innecesariamente.

## Veredicto

**PRD-ready condicionado**

Condiciones antes de PRD:
- Completar checklist Docker final sin fallos bloqueantes.
- Validar UI/SSE en navegador real.
- Confirmar allowlist real de temporales por ambiente.
- Medir latencia/logs del middleware con trafico normal.
