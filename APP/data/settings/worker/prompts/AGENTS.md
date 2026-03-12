# AGENTS.md

## Ambito
Este archivo aplica a `APP/data/settings/worker/prompts`.

Estos archivos son prompts runtime usados por el worker y montados tambien en el backend. No son instrucciones para el agente de desarrollo.

## Reglas de cambio
- Mantener separado el prompt de producto de las instrucciones del agente.
- Preservar reglas explicitas de:
  - no inventar informacion
  - respetar input entregado
  - salida estructurada y consistente
- Si cambias estructura esperada de salida, revisar impacto en:
  - worker
  - validadores
  - backend
  - consumidores posteriores
- Preferir cambios puntuales y trazables por version de prompt.
- No borrar versiones anteriores sin justificacion clara.

## Convencion practica
- Tratar cada `system_prompt_vXX.txt` como version historica.
- Si se crea una nueva version, mantener criterio de versionado existente.
- Documentar en la entrega que comportamiento esperado cambia con el nuevo prompt.

## Operacion
- No probar prompts llamando servicios externos ni APIs desde el agente.
- No mezclar datos sensibles ni credenciales dentro del prompt.

## Validacion sugerida
- Revisar coherencia semantica del prompt con el schema de salida esperado.
- Indicar al usuario que la validacion funcional debe hacerse a traves del flujo Docker del worker.
