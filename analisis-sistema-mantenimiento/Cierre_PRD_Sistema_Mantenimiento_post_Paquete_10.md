# Cierre PRD Sistema Mantenimiento - Post Paquete 10

Fecha de validacion: 2026-05-29 / 2026-05-30 UTC  
Modulo: `Sistema >> Mantenimiento`  
Alcance: correccion frontend del doble modal/doble POST en ejecucion manual de `cleanup_temp_files`.

## Veredicto

**PRD-ready condicionado.**

El hallazgo Alto de frontend queda **cerrado**: despues de la correccion, la validacion real en navegador mostro un solo modal, un solo boton `Confirmar`, un solo POST `202` ante doble click rapido y una sola fila nueva en `system_maintenance_runs`.

La condicion residual no pertenece al fix de doble ejecucion: sigue pendiente una prueba de degradacion real de SSE para demostrar polling fallback con el stream cortado. En esta validacion el SSE funciono correctamente y la UI refresco estado, pero no se simulo perdida del stream.

## Resumen ejecutivo

- Se reemplazo el uso de `ModalManager.confirm` para ejecuciones manuales por un modal custom especifico.
- El modal nuevo bloquea el boton `Confirmar` antes del `await` y usa un `dispatchGuardRef` interno.
- El panel mantiene un guard externo `runNowGuardRef` para impedir doble apertura de modal.
- Se reconstruyo el frontend productivo.
- Se valido en Chrome headless real contra `http://minuetaitor.vsoto.cl/`.
- Network registro exactamente un POST a `/api/v1/system/maintenance/run/temp-cleanup`.
- Consola navegador no registro errores criticos.
- SSE `/api/v1/system/maintenance/events` siguio conectado con `200 text/event-stream`.
- Ledger registro una sola ejecucion nueva.

## Causa raiz

El flujo anterior dependia de `ModalManager.confirm`, que cierra/resuelve el modal al confirmar y no controla un estado local de dispatch dentro del propio boton `Confirmar`. Bajo doble click rapido sobre el boton principal, el panel podia abrir dos confirmaciones antes de que React reflejara el estado visual de bloqueo; luego ambas confirmaciones terminaban despachando ejecuciones manuales.

La correccion separa el caso sensible de ejecucion manual:

- `ManualRunConfirmModal` mantiene `isDispatching` y `dispatchGuardRef`.
- `handleConfirm` ejecuta `preventDefault` y `stopPropagation`.
- El guard interno se activa antes del `await onConfirm()`.
- El boton `Confirmar` queda disabled y cambia a `Encolando...`.
- `openManualRunConfirmModal` usa `closeOnOverlayClick=false` y `closeOnEscape=false`.
- `handleRunNow` mantiene `runNowGuardRef`, `confirmingRunNowAction` y `runningNowAction`.

## Archivos modificados

- `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx`
- `analisis-sistema-mantenimiento/Cierre_PRD_Sistema_Mantenimiento_post_Paquete_10.md`
- `analisis-sistema-mantenimiento/README.md`

## Cambios aplicados

Evidencia de codigo:

- `SystemSettingsMaintenancePanel.jsx`, lineas aproximadas 182-235:
  - nuevo `ManualRunConfirmModal`.
  - guard interno `dispatchGuardRef`.
  - `preventDefault`/`stopPropagation`.
  - boton `Confirmar` con `type="submit"` y disabled durante dispatch.

- `SystemSettingsMaintenancePanel.jsx`, lineas aproximadas 260-292:
  - nuevo `openManualRunConfirmModal`.
  - modal custom sin cierre por overlay/escape.
  - propagacion de errores al flujo del panel.

- `SystemSettingsMaintenancePanel.jsx`, lineas aproximadas 540-588:
  - `handleRunNow` usa el modal custom.
  - bloqueo antes del await mediante `runNowGuardRef`.
  - despacho unico a `runSessionCleanupNow` o `runTempCleanupNow`.
  - refresh runtime y toast posterior.

## Evidencia generada

- Screenshot modal unico: `analisis-sistema-mantenimiento/evidencias-paquete-10/paquete-10-modal-unico.png`
- Screenshot post confirmacion: `analisis-sistema-mantenimiento/evidencias-paquete-10/paquete-10-post-confirm.png`
- Resumen CDP/Network/console: `analisis-sistema-mantenimiento/evidencias-paquete-10/paquete-10-ui-summary.json`

## Validacion en navegador

Resultado: **OK**.

Datos relevantes de `paquete-10-ui-summary.json`:

```json
{
  "login": { "ok": true, "username": "admin", "roles": ["ADMIN"] },
  "modal": {
    "modalTitleCount": 1,
    "confirmButtons": 1,
    "confirmDisabled": [false]
  },
  "postRequests": [
    {
      "url": "http://minuetaitor.vsoto.cl/api/v1/system/maintenance/run/temp-cleanup",
      "status": 202,
      "mimeType": "application/json"
    }
  ],
  "failures": [],
  "consoleEvents": []
}
```

Interpretacion:

- El doble click sobre `Ejecutar ahora` produjo un solo modal.
- El modal mostro un solo boton `Confirmar`.
- El doble click rapido sobre `Confirmar` produjo exactamente un POST.
- No hubo segundo POST.
- No hubo fallas de Network.
- No hubo errores criticos de consola.

## Validacion SSE/UI

Resultado: **OK**.

Evidencia:

- `GET /api/v1/system/maintenance/events` respondio `200`.
- `mimeType`: `text/event-stream`.
- La UI mostro `SSE + respaldo 90s`.
- Despues del job, la UI actualizo el runtime de `cleanup_temp_files` a:
  - `OK`
  - `Ultima ejecucion`: `29/05/2026 23:50`
  - `Registros afectados`: `2`

## Validacion SQL run ledger

Consulta ejecutada:

```sql
SELECT id, job_id, action, trigger_type, status, created_at, affected_count, message, correlation_id
FROM system_maintenance_runs
WHERE action='cleanup_temp_files' AND trigger_type='manual'
ORDER BY created_at DESC
LIMIT 10;
```

Fila nueva post-fix:

```text
id=8c0328c8-f897-42eb-8473-5b82193bbf81
job_id=a5a82e71-3de6-43d8-962b-550833c8dd4e
action=cleanup_temp_files
trigger_type=manual
status=success
created_at=2026-05-30 03:50:09
affected_count=2
correlation_id=673733e8-482a-491c-8788-50156d6f6f0b
message=Limpieza de temporales simulada | scanned=5 deleted_files=2 deleted_dirs=0 skipped=3 failed=0 retention_days=1 safety_grace_minutes=30 allowed_roots=4.
```

Interpretacion:

- Antes de la prueba habia 5 ejecuciones manuales `cleanup_temp_files`.
- Despues de doble click principal + doble click en confirmar, se observo una sola nueva ejecucion.
- No se reprodujo la duplicidad de dos jobs simultaneos.

## Tabla de validaciones

| Caso | Resultado | Evidencia |
| --- | --- | --- |
| UI carga para ADMIN | OK | `login.ok=true`, rol `ADMIN`. |
| Modal unico | OK | `modalTitleCount=1`. |
| Un solo boton Confirmar | OK | `confirmButtons=1`. |
| Confirmar produce un solo POST | OK | `postRequests.length=1`, status `202`. |
| Doble click protegido | OK | doble click automatizado sobre `Confirmar`, un solo POST. |
| Boton principal bloqueado al abrir modal | OK | UI cambia boton de temporales a `Confirmando...`. |
| Estado visual posterior | OK | UI muestra `OK`, fecha `23:50`, afectados `2`. |
| Ledger coherente | OK | una sola fila nueva `success`. |
| SSE sigue conectado | OK | `/maintenance/events` `200 text/event-stream`. |
| UI refresca estado | OK | runtime visual actualizado sin recarga manual. |
| Consola navegador | OK | `consoleEvents=[]`. |
| Network critico | OK | `failures=[]`. |
| Build frontend | OK | `docker compose -f docker-compose.yml up -d --build frontend`. |

## Hallazgos residuales

### P10-R01 - Polling fallback con SSE cortado no ejecutado

Severidad: **Medio**  
Estado: **Abierto condicionante**

No se simulo una interrupcion real de `/api/v1/system/maintenance/events`. El SSE funciona, pero falta la prueba de degradacion para declarar cierre PRD pleno sin condicion.

Mitigacion recomendada:

- Bloquear temporalmente `/api/v1/system/maintenance/events` desde DevTools/proxy.
- Ejecutar `cleanup_temp_files` desde otra sesion o API.
- Medir convergencia por polling sin recarga manual.

### P10-R02 - Estados transitorios no capturados visualmente

Severidad: **Bajo**  
Estado: **Abierto no bloqueante**

El job finaliza muy rapido; se valido `success`, pero no se obtuvo captura estable de `dispatch_pending`, `queued` o `running`.

Mitigacion recomendada:

- Usar latencia controlada o rutina artificial lenta en QA para capturar estados transitorios.

## Hallazgo cerrado

### P10-F01 - Doble modal / doble POST en ejecucion manual

Severidad: **Alto**  
Estado: **Cerrado**

Evidencia de cierre:

- Un solo modal.
- Un solo boton `Confirmar`.
- Un solo POST `202`.
- Una sola fila nueva en `system_maintenance_runs`.
- Sin errores de consola.

## Comandos/validaciones ejecutadas

- `docker compose -f docker-compose.yml up -d --build frontend`
- Chrome headless con DevTools/CDP.
- Script CDP temporal: `/tmp/p10_cdp_validation.mjs`
- Query SQL contra `system_maintenance_runs`.
- `git diff --check`

## Recomendacion final

El submodulo queda sin hallazgos Críticos o Altos abiertos asociados a frontend manual run. Puede mantenerse como **PRD-ready condicionado** hasta ejecutar la prueba de polling fallback con SSE cortado. Si esa prueba converge correctamente, el submodulo puede pasar a **PRD-ready**.
