# AGENTS.md

## Ambito
Este archivo aplica a `APP/volumes/worker`.

Este worker corre como proceso independiente en Docker y consume colas Redis para generacion asistida por IA, mantenimiento y correo.

## Arquitectura vigente
- Entry point: `app/worker.py`
- Configuracion: `app/core/config.py`
- Registro de handlers: `app/core/registry.py`
- Envelope de jobs: `app/core/job.py`
- Colas registradas: `app/queues`
- Handlers: `app/handlers`
- Prompts runtime montados desde `APP/data/settings/worker/prompts`

## Reglas de cambio
- Si cambias un job, alinear:
  - nombre de cola
  - `type` del job
  - payload esperado
  - handler registrado
  - productor del job en backend o scheduler
- Mantener el modelo actual:
  - BLPOP con prioridad
  - concurrencia controlada por semaforo
  - reintentos con backoff
  - envio a DLQ al agotar reintentos
- No esconder errores de contrato con defaults silenciosos si eso puede corromper minutas o artefactos.
- Si el cambio toca prompts, revisar tambien `APP/data/settings/worker/prompts`.
- Si el cambio toca llamadas internas al backend, revisar secreto interno, payload y rutas internas.

## IA y minutas
- Mantener reglas explicitas de no inventar informacion y salida estructurada.
- No mezclar instrucciones del agente de desarrollo con prompts runtime de producto.
- Si cambias parsing o validacion de salida IA, revisar consistencia con schemas y backend.

## Operacion
- No ejecutar el worker manualmente.
- No reinstalar dependencias.
- No reiniciar contenedores.

## Validacion sugerida
- Revisar wiring entre `queues`, `registry`, `handlers` y payloads productores.
- Verificar compatibilidad con backend interno, Redis y prompts montados.
- Dejar pasos manuales para que el usuario pruebe el flujo completo dentro de Docker.
