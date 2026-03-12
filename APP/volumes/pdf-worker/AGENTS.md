# AGENTS.md

## Ambito
Este archivo aplica a `APP/volumes/pdf-worker`.

Este proceso consume `queue:pdf`, renderiza HTML/Jinja y genera PDFs mediante Gotenberg y MinIO dentro del stack Docker.

## Arquitectura vigente
- Entry point: `app/main.py`
- Handler principal: `app/handlers/minute_pdf.py`
- Renderer: `app/renderer`
- Templates: `app/templates`
- Integraciones: Redis, MinIO, Gotenberg

## Reglas de cambio
- Si cambias payload de `minute_pdf`, revisar productor del job en backend y consumidor en este worker.
- Mantener consistencia entre:
  - `core/job.py`
  - handlers
  - renderer
  - templates HTML
- Si cambias templates, revisar placeholders, estructura esperada y compatibilidad visual basica.
- Si cambias integracion con almacenamiento, revisar nombres de bucket/objeto y contratos con backend.
- No asumir que un cambio de template es aislado si el HTML depende de datos transformados por el handler.

## Operacion
- No ejecutar Gotenberg ni el worker manualmente.
- No reinstalar dependencias ni reiniciar contenedores.

## Validacion sugerida
- Revisar flujo completo de datos: job Redis -> handler -> template -> Gotenberg -> MinIO.
- Indicar al usuario como validar generacion PDF desde el flujo Docker existente.
