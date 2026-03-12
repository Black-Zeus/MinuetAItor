# AGENTS.md

## Ambito
Este archivo aplica a `APP/volumes/scheduler`.

El scheduler corre dentro de Docker y dispara tareas cron que encolan jobs Redis o llaman al backend interno.

## Arquitectura vigente
- Entry point unico: `app/scheduler.py`
- Scheduler: APScheduler `BlockingScheduler`
- Integraciones:
  - Redis para jobs de mantenimiento
  - Backend interno via `x-internal-secret`
- Timezone operativa: `America/Santiago`

## Reglas de cambio
- Si agregas o cambias un cron, documentar claramente:
  - frecuencia
  - timezone
  - queue o endpoint interno afectado
  - impacto operativo
- Si cambias un job encolado, revisar tambien el worker consumidor.
- Si cambias una llamada interna, revisar la ruta backend y el secreto interno.
- Evitar logica de negocio compleja en el scheduler; debe coordinar, no reemplazar servicios.

## Operacion
- No ejecutar el scheduler manualmente.
- No reinstalar dependencias.
- No reiniciar contenedores.

## Validacion sugerida
- Revisar expresiones cron, nombres de jobs y contratos con Redis/backend.
- Indicar al usuario que valide la ejecucion en su stack Docker y revise logs del scheduler si corresponde.
