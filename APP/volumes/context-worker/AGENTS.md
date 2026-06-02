# AGENTS.md

## Ambito
Este archivo aplica a `APP/volumes/context-worker`.

El context-worker corre dentro de Docker y se encarga exclusivamente de procesos de Knowledge Search / Contexto IA: indexacion, reindexacion, sincronizacion semantica y comunicacion con Qdrant.

## Reglas
- No asumir ejecucion local de Python fuera del contenedor.
- No mezclar handlers del worker de minutas con este worker salvo utilidades claramente compartibles.
- Mantener este worker dedicado a `queue:context`.
- No aplicar ACL en el worker; la autorizacion de usuarios se resuelve en backend.
- No usar transcripciones crudas como fuente oficial.
- La fuente oficial para indexar debe venir desde minutas finales validadas.

