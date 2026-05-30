# Microvalidacion final PRD - Sistema Mantenimiento post Paquete 10

Fecha de validacion: 2026-05-30  
Modulo: `Sistema >> Mantenimiento`  
Objetivo: cerrar pendientes residuales del Paquete 10: doble click rapido y polling fallback con SSE bloqueado.

## Veredicto final

**PRD-ready.**

La microvalidacion final confirma:

- Doble click rapido sobre `Confirmar` genera exactamente un POST.
- No se reproduce doble modal ni doble POST.
- SSE de mantenimiento puede ser bloqueado/cortado y la UI converge por polling a `/api/v1/system/maintenance/status`.
- No hay errores criticos de consola.
- El ledger queda consistente con la UI.

## Evidencias

Carpeta:

`analisis-sistema-mantenimiento/evidencias-paquete-10-microvalidacion/`

Archivos principales:

- `microvalidacion-summary.json`: Prueba A y primera pasada de Prueba B.
- `polling-fallback-robusto-summary.json`: Prueba B estricta con timestamp unico y SSE bloqueado.
- `prueba-a-modal-unico.png`: modal unico antes de confirmar.
- `prueba-a-post-confirm.png`: estado posterior a doble click en `Confirmar`.
- `prueba-b-sse-bloqueado-before.png`: UI con SSE bloqueado y `Refresco normal`.
- `prueba-b-fallback-robusto.png`: UI convergida por polling.

## Prueba A - doble click rapido

Resultado: **OK**.

Resumen:

- Login ADMIN: OK.
- Modal de limpieza de temporales: unico.
- Boton `Confirmar`: unico.
- Doble click rapido sobre `Confirmar`: ejecutado.
- Network: exactamente un POST a `/api/v1/system/maintenance/run/temp-cleanup`.
- Status POST: `202`.
- No hubo segundo POST.
- UI quedo en estado terminal `OK` sin duplicar ejecucion.

Evidencia de `microvalidacion-summary.json`:

```json
{
  "pruebaA": {
    "modal": {
      "modalTitleCount": 1,
      "confirmButtons": 1
    },
    "postCount": 1,
    "postRequests": [
      {
        "url": "http://minuetaitor.vsoto.cl/api/v1/system/maintenance/run/temp-cleanup",
        "status": 202,
        "mimeType": "application/json"
      }
    ],
    "result": "OK"
  }
}
```

## Prueba B - polling fallback con SSE bloqueado

Resultado: **OK**.

Metodo:

- Se bloqueo `*/api/v1/system/maintenance/events*` desde Chrome DevTools Protocol.
- La UI quedo sin indicador `SSE + respaldo 90s` y mostro `Refresco normal`.
- Se ejecuto `cleanup_temp_files` desde una sesion/API externa.
- Se espero convergencia de UI por polling.
- Para evitar falso positivo por minuto repetido, se repitio la prueba estricta esperando un minuto visual distinto y buscando el timestamp dentro del bloque operativo `ENCOLADO`.

Evidencia de `polling-fallback-robusto-summary.json`:

```json
{
  "externalRun": {
    "status": 202
  },
  "expectedTimestamp": "2026-05-30T04:02:22+00:00",
  "finalLabel": {
    "label": "30/05/2026 00:02",
    "found": true
  },
  "converged": true,
  "convergenceMs": 116133,
  "statusRequestCountAfterExternalRun": 1,
  "consoleEvents": [],
  "result": "OK"
}
```

Interpretacion:

- SSE fue efectivamente bloqueado: se registraron eventos bloqueados con `blockedReason=inspector`.
- La UI convergio en aproximadamente **116 segundos**, coherente con el polling de respaldo cuando SSE no esta conectado.
- Hubo al menos un `GET /api/v1/system/maintenance/status` posterior al job externo.
- La UI actualizo `ENCOLADO` y `ULTIMA EJECUCION` a `30/05/2026 00:02`.
- No hubo errores criticos de consola.

## Network

Prueba A:

- POST `/api/v1/system/maintenance/run/temp-cleanup`: **1**
- Status: `202`
- Segundo POST: **No evidenciado**

Prueba B:

- SSE `/api/v1/system/maintenance/events`: bloqueado intencionalmente por inspector.
- `GET /api/v1/system/maintenance/status` posterior al job externo: **1**
- Convergencia por polling: **OK**

## Ledger

Ultimas ejecuciones manuales relevantes:

```text
2026-05-30 04:02:22 cleanup_temp_files manual success job_id=82b0604f-f4a5-4973-acaf-e1dbda758cd8 affected_count=2
2026-05-30 04:01:40 cleanup_temp_files manual success job_id=aea0e08d-31df-4dec-8ff1-a89483ebcc06 affected_count=2
2026-05-30 03:59:39 cleanup_temp_files manual success job_id=0265b317-f420-493b-9fca-260725cd1d6c affected_count=2
2026-05-30 03:59:26 cleanup_temp_files manual success job_id=7565dc07-d97b-4b22-8942-abd25a86ddc5 affected_count=2
```

La fila `2026-05-30 03:59:26` corresponde a Prueba A. La fila `2026-05-30 04:02:22` corresponde a la Prueba B robusta.

## Console events

Resultado: **OK**.

- Prueba A: sin errores criticos.
- Prueba B robusta: `consoleEvents=[]`.

Los `loadingFailed` de SSE en la Prueba B son esperados porque el endpoint fue bloqueado deliberadamente con DevTools/CDP.

## Tabla final

| Validacion | Resultado | Evidencia |
| --- | --- | --- |
| UI carga para ADMIN | OK | `login.ok=true`, rol `ADMIN`. |
| Modal unico | OK | `modalTitleCount=1`. |
| Un solo boton Confirmar | OK | `confirmButtons=1`. |
| Doble click en Confirmar | OK | `postCount=1`. |
| Network sin doble POST | OK | un solo POST `202`. |
| SSE conectado en flujo normal | OK | validado en Paquete 10. |
| SSE bloqueado para fallback | OK | `blockedReason=inspector`. |
| Polling fallback converge | OK | `statusRequestCountAfterExternalRun=1`, `converged=true`. |
| Tiempo de convergencia | OK | `116133 ms`. |
| UI actualiza runtime | OK | `ENCOLADO 30/05/2026 00:02`. |
| Consola critica | OK | `consoleEvents=[]`. |
| Ledger consistente | OK | ultima ejecucion `success`, `affected_count=2`. |

## Riesgos residuales

No quedan hallazgos Criticos ni Altos abiertos para el submodulo.

Riesgos bajos aceptables:

- Los estados transitorios `dispatch_pending`, `queued` y `running` pueden ser dificiles de capturar visualmente porque el job completa muy rapido.
- El fallback por polling converge cerca del intervalo esperado; en produccion, durante SSE caido, la UI puede tardar hasta unos 120 segundos en reflejar cambios si no hay una rutina activa conocida por el panel.

## Recomendacion final

Declarar `Sistema >> Mantenimiento` como **PRD-ready** para el alcance validado:

- Backend/worker/Redis/DB/ledger validados en paquetes previos.
- UI validada con navegador real.
- Doble ejecucion manual corregida.
- SSE validado.
- Polling fallback validado con SSE bloqueado.
- Sin hallazgos Criticos o Altos abiertos.
