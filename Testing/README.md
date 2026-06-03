# Testing

## Proposito
Este directorio organiza el plan de QA y pruebas automatizadas de MinuetAItor.

La idea es pasar desde pruebas manuales informales hacia una practica repetible:
- primero documentada,
- luego ejecutable manualmente con checklist,
- despues automatizada por modulo,
- finalmente integrada a CI/CD.

## Como leer esta carpeta
Empieza por:
1. [Estrategia general](00-estrategia-general.md)
2. [Mapa de cobertura](01-mapa-cobertura.md)
3. [Flujos criticos](02-flujos-criticos.md)

Luego abre el modulo que quieras trabajar:
- [Backend API](backend-api/README.md)
- [Frontend](frontend/README.md)
- [Workers y colas](workers-colas/README.md)
- [PDF y artefactos](pdf-artefactos/README.md)
- [Integraciones IA](integraciones-ia/README.md)
- [Base de datos](base-datos/README.md)
- [E2E y smoke tests](e2e-smoke/README.md)
- [Datos QA](datos-qa/README.md)

## Montaje en contenedor
El servicio `qa-tools` monta esta carpeta dentro del contenedor en:

- Host: `./Testing`
- Contenedor: `/workspace/Testing`

La carpeta se monta principalmente en modo solo lectura para proteger definiciones y tests. La excepcion es:

- `./Testing/reports` -> `/workspace/Testing/reports`

Esa carpeta queda persistente para guardar outputs de pruebas.

## Regla practica
No todo debe automatizarse al inicio.

Prioridad sugerida:
1. Documentar el flujo esperado.
2. Crear checklist manual repetible.
3. Crear smoke test automatico.
4. Crear pruebas de contrato y permisos.
5. Llevarlo a CI/CD.

## Definicion de listo para el punto 01
El punto 01 se considera sellado cuando:
- Existe mapa de cobertura por modulo.
- Los flujos criticos tienen checklist manual.
- Los flujos criticos tienen al menos smoke test automatizable definido.
- Auth, RBAC, minutas y workers tienen pruebas de contrato o casos esperados.
- Existe dataset QA minimo documentado.
- Se sabe que pruebas deben correr antes de promocion, piloto y release.
