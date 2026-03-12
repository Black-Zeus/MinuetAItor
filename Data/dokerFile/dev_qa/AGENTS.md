# AGENTS.md

## Ambito
Este archivo aplica a `Data/dokerFile/dev_qa`.

Aqui viven los Dockerfiles usados por los ambientes de desarrollo y QA.

## Reglas de cambio
- Cambiar estos archivos solo cuando el requerimiento sea realmente de infraestructura o build.
- Mantener alineacion con `docker-compose-dev.yml` y `docker-compose-qa.yml`.
- No introducir pasos que dependan de operacion automatizada fuera de Docker.
- Si una imagen necesita nueva dependencia del sistema o del runtime, documentarlo claramente para el usuario.
- No asumir que puedes validar builds localmente desde este entorno de agente.

## Operacion
- No ejecutar `docker build`, `docker compose build` ni scripts operativos.
- No usar `docker_tools_v2.sh`.
- Si el cambio requiere rebuild, dejarlo como paso manual del usuario.

## Validacion sugerida
- Revisar consistencia entre rutas copiadas, comandos de arranque y compose asociado.
