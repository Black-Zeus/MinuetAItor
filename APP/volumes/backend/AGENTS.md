# AGENTS.md

## Ambito
Este archivo aplica a `APP/volumes/backend`.

El backend corre dentro del contenedor `backend` definido en `docker-compose-dev.yml`. No asumir ejecucion local de Python ni gestion manual del proceso fuera de Docker.

## Arquitectura vigente
- Entry point: `app/main.py`
- Capas:
  - `app/models`
  - `app/schemas`
  - `app/services`
  - `app/repositories`
  - `app/routers/v1`
  - `app/routers/internal`
  - `app/core`
  - `app/db`
- El backend monta prompts runtime desde `APP/data/settings/worker/prompts` sobre `/app/assets/prompts`.
- El backend registra eventos en `events/pdf_dispatch.py`.

## Reglas de cambio
- Mantener versionado HTTP bajo `/v1`.
- Respetar el contrato de respuesta y middlewares globales de `core/middleware.py`.
- Si cambias un endpoint, revisar:
  - schema de entrada/salida
  - servicio afectado
  - router expuesto
  - consumo desde frontend
- Si cambias persistencia, revisar:
  - modelo SQLAlchemy
  - SQL manual en `APP/data/settings/mariadb/init`
  - servicio y schema relacionados
- Si cambias carga de archivos, artefactos o PDF, revisar integracion con MinIO, Redis y `events/pdf_dispatch.py`.
- Si cambias jobs o procesos internos, revisar tambien `routers/internal` y los workers consumidores.

## Seguridad y autorizacion
- `app/main.py` contiene recursos con TODO de RBAC; no ampliar superficie sin revisar autorizacion.
- Si el cambio toca autenticacion o permisos, revisar minimo:
  - `app/core/security.py`
  - `app/core/authz.py`
  - `app/services/auth_service.py`
  - `app/repositories/auth_repository.py`
- No exponer por la API publica tablas de sistema que hoy estan desactivadas sin justificar el riesgo.
- Mantener separacion entre rutas publicas `/v1` y rutas internas `/internal/...` protegidas por secreto interno.

## Persistencia y esquema
- No existe framework de migraciones visible.
- Todo cambio de esquema debe quedar reflejado en `APP/data/settings/mariadb/init`.
- No usar seeds para compensar errores de logica del servicio.

## Dependencias y operacion
- Si una dependencia cambia, editar `requirements.txt` y avisar al usuario.
- No ejecutar `pip install`, `uvicorn`, seeds ni scripts de operacion.
- No reiniciar contenedores ni procesos del backend.

## Validacion sugerida
- Revisar imports, wiring de routers y dependencias.
- Verificar consistencia entre modelo, schema, servicio y router.
- Indicar al usuario que valide dentro de Docker los endpoints afectados y, si aplica, el flujo frontend asociado.
