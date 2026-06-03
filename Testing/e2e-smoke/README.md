# E2E y smoke tests

## Objetivo
Definir pruebas cortas que confirmen que el producto funciona de punta a punta.

## Smoke minimo antes de demo
- Login admin.
- Dashboard carga.
- Crear cliente demo.
- Crear proyecto demo.
- Crear participante demo.
- Crear o abrir minuta demo.
- Generar preview PDF.
- Abrir reporte de gestion.
- Abrir configuracion sistema como admin.
- Logout.

## Smoke minimo antes de piloto
Incluye lo anterior mas:
- Usuario no admin con permisos limitados.
- Validacion de scope por cliente/proyecto.
- Revision externa con OTP/token.
- Observacion externa.
- Reproceso de minuta fallida controlada.
- Backup manual.
- Verificacion de logs sin secretos.

## Checklist inicial
- [ ] Definir URL base por entorno.
- [ ] Definir usuarios QA.
- [ ] Definir datos demo.
- [ ] Definir orden de ejecucion.
- [ ] Definir evidencia esperada.
- [ ] Definir condiciones de fallo bloqueante.

## Criterio de fallo bloqueante
Una prueba E2E bloquea promocion si:
- impide login,
- expone datos sin permiso,
- rompe generacion de minuta,
- rompe PDF,
- rompe revision externa,
- muestra error tecnico no controlado en demo,
- deja job colgado sin recuperacion.
