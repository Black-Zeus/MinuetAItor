# Datos QA

## Objetivo
Definir datos de prueba seguros, repetibles y no sensibles.

## Principio
Nunca usar datos reales de clientes para demo, QA o pruebas automatizadas.

## Dataset minimo

### Usuarios
- Admin QA.
- Editor QA con permisos de minutas.
- Viewer QA solo lectura.
- Usuario sin scope.

### Clientes
- Cliente Demo Norte.
- Cliente Demo Sur.

### Proyectos
- Proyecto Implementacion.
- Proyecto Soporte Mensual.

### Participantes
- Participante interno.
- Participante externo.
- Revisor externo.

### Minutas
- Minuta simple.
- Minuta con acuerdos.
- Minuta con compromisos.
- Minuta con requerimientos.
- Minuta fallida controlada.

### Archivos
- Transcripcion corta.
- Resumen corto.
- Archivo invalido controlado.

## Datasets disponibles
- [Minutas input](minutas-input/README.md): casos `mini`, `simple`, `normal` y `extenso` para pruebas de generacion de minutas.

Regla de consumo:
- Preferir `mini` para smoke tests.
- Usar `simple` para pruebas funcionales cortas.
- Usar `normal` o `extenso` solo bajo demanda directa para evitar sobreconsumo de tokens IA.

## Checklist inicial
- [ ] Definir nombres y correos ficticios.
- [ ] Definir transcripciones sinteticas.
- [ ] Definir datos con fechas controladas.
- [ ] Definir cliente sin acceso para pruebas de scope.
- [ ] Definir minuta con observaciones externas.
- [ ] Definir minuta con PDF generado.

## Evidencia
El dataset debe poder recrearse o documentarse sin depender de datos privados.
