# Cierre PRD Sistema Mantenimiento - Post Paquete 09

Fecha de validacion: 2026-05-29 / 2026-05-30 UTC  
Modulo: `Sistema >> Mantenimiento`  
Alcance: validacion real frontend/UI, consola navegador, Network, SSE, ejecucion manual y consistencia UI/API/ledger.

## Veredicto

**PRD-ready condicionado.**

El frontend real cargo correctamente con usuario ADMIN, no presento errores criticos de consola ni fallas HTTP criticas, el stream SSE de mantenimiento conecto dentro de la UI y la ejecucion manual convergio con API y ledger.

Durante la validacion se encontro un defecto operativo en UI: un doble click sobre `Ejecutar ahora` podia abrir dos confirmaciones y despachar dos ejecuciones manuales. Se aplico una correccion acotada en frontend y se revalido con navegador real: despues del ajuste se observo un unico modal y el ledger aumento solo en una ejecucion.

El unico pendiente que mantiene la condicion es que **no se simulo/corto el SSE para probar polling fallback en degradacion real**. La UI muestra `SSE + respaldo 90s`, pero no se ejecuto una prueba controlada de perdida de stream.

## Cambios aplicados en este paquete

- `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx`
  - Agrega guard sincrono con `runNowGuardRef` y estado `confirmingRunNowAction` para bloquear doble apertura de confirmacion.
  - Considera `dispatch_pending` como estado activo y `dispatch_error` como estado visible.
  - Ajusta etiquetas de boton: `Confirmando...`, `Encolando...`, `Preparando despacho`, `En cola`, `En curso`, `Finalizado con advertencia`, `Reintentar ahora`.
  - Bloquea los botones manuales cuando la rutina correspondiente esta activa.
  - Expone en UI el respaldo de polling `SSE + respaldo 90s`.

Evidencia de codigo:
- `SystemSettingsMaintenancePanel.jsx`, lineas aproximadas 285-291: estados/ref de bloqueo.
- `SystemSettingsMaintenancePanel.jsx`, lineas aproximadas 403-503: guard de confirmacion y ejecucion manual.
- `SystemSettingsMaintenancePanel.jsx`, lineas aproximadas 541-556: etiquetas/estados activos.
- `SystemSettingsMaintenancePanel.jsx`, lineas aproximadas 848-920: botones manuales bloqueados por rutina.
- `SystemSettingsMaintenancePanel.jsx`, lineas aproximadas 1156-1159: indicador `SSE + respaldo 90s`.

## Evidencias generadas

- Captura UI autenticada: `analisis-sistema-mantenimiento/evidencias-paquete-09/paquete-09-maintenance-ui-auth.png`
- Resumen UI autenticada: `analisis-sistema-mantenimiento/evidencias-paquete-09/paquete-09-ui-auth-summary.json`
- Captura del defecto inicial con doble modal: `analisis-sistema-mantenimiento/evidencias-paquete-09/paquete-09-after-confirm.png`
- Resumen del defecto inicial: `analisis-sistema-mantenimiento/evidencias-paquete-09/paquete-09-after-confirm-summary.json`
- Captura post-fix con un solo modal: `analisis-sistema-mantenimiento/evidencias-paquete-09/paquete-09-fix-modal.png`
- Captura post-fix luego de confirmar: `analisis-sistema-mantenimiento/evidencias-paquete-09/paquete-09-fix-after-confirm.png`
- Resumen post-fix: `analisis-sistema-mantenimiento/evidencias-paquete-09/paquete-09-fix-summary.json`

Nota: en `paquete-09-fix-summary.json`, el campo `confirmButtons: 2` corresponde al selector automatizado que conto tambien botones base con texto `Ejecutar ahora`; la captura post-fix muestra un unico modal y el ledger confirma una sola ejecucion nueva.

## Validacion UI

| Item | Resultado | Evidencia |
| --- | --- | --- |
| Login ADMIN | OK | `paquete-09-ui-auth-summary.json`: `login.ok=true`, rol `ADMIN`. |
| Carga pantalla mantenimiento | OK | Captura `paquete-09-maintenance-ui-auth.png`. |
| Modo operativo visible | OK | UI muestra `Puesta en marcha`. |
| Runtime cleanup_sessions visible | OK | UI muestra ultimo resultado y estado `OK`. |
| Runtime cleanup_temp_files visible | OK | UI muestra ultimo resultado, estado `OK`, fechas y registros afectados. |
| Configuracion cron/retencion/sesiones visible | OK | UI muestra `* * * * *`, estrategia de sesiones y retencion `1 dias`. |
| Botones manuales visibles | OK | UI muestra botones `Ejecutar ahora` para sesiones y temporales. |
| Consola navegador | OK | `paquete-09-fix-summary.json`: `consoleEvents: []`. |
| Network tab | OK | `paquete-09-fix-summary.json`: `failures: []`. |

## Validacion SSE dentro de UI

Resultado: **OK**.

Evidencia:
- `paquete-09-fix-summary.json` registra `GET /api/v1/system/maintenance/events` con `status=200` y `mimeType=text/event-stream`.
- La UI muestra `SSE + respaldo 90s`.
- Despues de ejecutar limpieza de temporales, la UI actualizo el runtime sin recarga manual y mostro ultima lectura `29/05/2026 23:23`.

Observacion residual:
- El fallback por polling no fue forzado cortando SSE. Queda como pendiente no bloqueante-condicionante para eliminar la condicion del veredicto.

## Validacion doble ejecucion manual

### Defecto encontrado antes del fix

Resultado inicial: **Fail**.

Al hacer doble click sobre `Ejecutar ahora` de limpieza de temporales, la UI permitio abrir dos modales de confirmacion. Al confirmar, se generaron dos ejecuciones manuales simultaneas.

Evidencia ledger:

```text
2026-05-30 03:17:29 cleanup_temp_files manual success job_id=1f2d4d49-d3a0-4f92-8e0b-e25bb14b1875 correlation_id=720ed2cd-11e2-418c-ae85-5dfcfa52a28b
2026-05-30 03:17:29 cleanup_temp_files manual success job_id=2c4a6669-f6f8-4b6b-a80d-88faf47fa84d correlation_id=571899cb-cab0-49fd-9b85-60d1c0cee872
```

Impacto: riesgo de duplicidad por accion manual rapida desde UI, aunque el backend mantiene trazabilidad por `job_id`.

Correccion aplicada: guard sincrono antes de abrir confirmacion y bloqueo por estado activo.

### Revalidacion post-fix

Resultado final: **OK**.

La prueba de doble click post-fix mostro un solo modal y, luego de confirmar, el ledger registro solo una ejecucion nueva:

```text
2026-05-30 03:23:41 cleanup_temp_files manual success job_id=6619f177-efda-4b74-a907-b3f27a680843 correlation_id=f38baa90-6165-4b5c-844e-ec3d26802fab affected_count=2
```

La UI final mostro:
- `Ultima ejecucion`: `29/05/2026 23:23`
- `Ultimo estado`: `OK`
- `Registros afectados`: `2`
- Mensaje: `Limpieza de temporales simulada | scanned=5 deleted_files=2 ... allowed_roots=4.`

## Consistencia UI/API/ledger

Resultado: **OK**.

La UI final, el endpoint de estado y `system_maintenance_runs` quedaron coherentes:

- UI: limpieza de temporales en `OK`, fecha `29/05/2026 23:23`, afectados `2`.
- Network: `POST /api/v1/system/maintenance/run/temp-cleanup` respondio `202`.
- Network: multiples `GET /api/v1/system/maintenance/status` respondieron `200`.
- Ledger: job `6619f177-efda-4b74-a907-b3f27a680843` quedo `success`, `affected_count=2`, `correlation_id=f38baa90-6165-4b5c-844e-ec3d26802fab`.

## Estados visuales de ejecucion

| Estado | Resultado | Nota |
| --- | --- | --- |
| `success` | OK | Validado en UI con limpieza de temporales. |
| `dispatch_pending` | Parcial | Mapeado en UI como `Preparando despacho`; no capturado visualmente por duracion corta. |
| `queued` | Parcial | Mapeado en UI como `En cola`; no capturado visualmente por duracion corta. |
| `running` | Parcial | Mapeado en UI como `En curso`; no capturado visualmente por duracion corta. |
| `warning` | No ejecutado | Mapeado en UI como `Finalizado con advertencia`; no se forzo warning. |
| `error` | No ejecutado | Mapeado en UI como `Reintentar ahora`; no se forzo error destructivo. |
| `dispatch_error` | Parcial | Existe evidencia historica en ledger; mapeado en UI como `Error de despacho`/`Reintentar ahora`, pero no estaba como runtime vigente. |

## Hallazgos abiertos

### P09-M01 - Polling fallback no simulado

Severidad: **Medio**  
Estado: **Abierto condicionante**

Evidencia:
- UI muestra `SSE + respaldo 90s`.
- SSE real conecta con `200 text/event-stream`.
- No se corto `/api/v1/system/maintenance/events` ni se simulo perdida de stream durante la prueba.

Impacto:
- No queda demostrada aun la convergencia de UI si EventSource falla o se pierde un evento.

Recomendacion:
- Ejecutar una prueba controlada bloqueando temporalmente `/api/v1/system/maintenance/events` desde DevTools o proxy, disparar un job desde otra sesion/API y medir convergencia por polling.

### P09-L01 - Estados transitorios no capturados visualmente

Severidad: **Bajo**  
Estado: **Abierto no bloqueante**

Evidencia:
- Los jobs manuales completan muy rapido; la captura final mostro `success`.
- La UI tiene mapeo para estados transitorios, pero no se obtuvo captura en `dispatch_pending`, `queued` o `running`.

Impacto:
- Riesgo bajo de no haber observado visualmente estados de corta duracion.

Recomendacion:
- Probar con una rutina artificial lenta o con latencia controlada en QA para capturar estados transitorios.

## Hallazgo cerrado en el paquete

### P09-F01 - Doble click generaba doble ejecucion manual

Severidad: **Alto**  
Estado: **Cerrado**

Evidencia inicial:
- Dos jobs manuales `cleanup_temp_files` simultaneos a `2026-05-30 03:17:29`.

Correccion:
- Guard sincrono `runNowGuardRef`.
- Estado `confirmingRunNowAction` antes de abrir modal.
- Bloqueo por rutina activa y por confirmacion en curso.

Evidencia final:
- Captura `paquete-09-fix-modal.png`: un solo modal visible.
- Ledger post-fix: una sola ejecucion nueva a `2026-05-30 03:23:41`.

## Checklist Paquete 09

- [x] UI real carga con usuario ADMIN.
- [x] Pantalla `Sistema >> Mantenimiento` visible.
- [x] Consola navegador sin errores criticos.
- [x] Network sin fallas HTTP criticas.
- [x] SSE de mantenimiento conectado dentro de UI.
- [x] UI refresca runtime luego de ejecucion manual sin recarga manual.
- [x] Ejecucion manual segura de `cleanup_temp_files` en dry-run validada.
- [x] Ledger actualizado con `job_id` y `correlation_id`.
- [x] Doble ejecucion manual por doble click corregida y revalidada.
- [x] UI/API/ledger coherentes para estado `success`.
- [ ] Polling fallback validado con SSE cortado.
- [ ] Captura visual de estados transitorios `dispatch_pending`, `queued`, `running`.
- [ ] Captura visual de `warning`, `error` o `dispatch_error` como runtime vigente.

## Checklist final PRD

- [x] Backend validado en paquetes previos.
- [x] Worker validado en paquetes previos.
- [x] Redis y queue `queue:maintenance` validados en paquetes previos.
- [x] Run ledger e idempotencia validados en paquetes previos.
- [x] `cleanup_temp_files` dry-run y allowlist validados en paquetes previos.
- [x] `cleanup_sessions` seguro validado en paquetes previos.
- [x] DB/marker escenarios A, B, C, D y E validados en paquetes previos.
- [x] Nginx/SSE HTTP validado en paquete 08.
- [x] UI real validada en paquete 09.
- [x] Bloqueo de doble ejecucion manual validado tras correccion.
- [ ] Polling fallback bajo perdida real de SSE.

## Comandos/validaciones ejecutadas

- `docker compose -f docker-compose.yml up -d --build frontend`
- `docker ps --format '{{.Names}}'`
- Chrome headless con DevTools/CDP contra `http://minuetaitor.vsoto.cl/settings/system?tab=maintenance`
- Query ledger:

```sql
SELECT id, job_id, action, trigger_type, status, affected_count, message, correlation_id, created_at
FROM system_maintenance_runs
WHERE action='cleanup_temp_files' AND trigger_type='manual'
ORDER BY created_at DESC
LIMIT 8;
```

- `git diff --check`

## Recomendacion final

El submodulo puede avanzar a **PRD-ready condicionado** con los cambios del Paquete 09 aplicados. Para declararlo **PRD-ready pleno**, falta ejecutar una prueba de degradacion de SSE que demuestre convergencia por polling sin recarga manual.
