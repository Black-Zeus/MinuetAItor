# REPORTES DE AUDITORIA TODO

Checklist maestro de reportes de auditoria para MinuetAItor.

## Scope

Estos reportes cubren:
- control
- trazabilidad
- evidencia
- seguridad
- compliance
- revisiones de acceso y cambios sensibles

No cubren:
- productividad operativa
- carga documental
- seguimiento ejecutivo de gestión
- KPIs funcionales del día a día

Estado sugerido:
- `[ ]` No iniciado
- `[/]` En progreso
- `[x]` Listo
- `[-]` Postergado

## 1. Auditoria de Accesos y Sesiones

- [ ] `Sesiones de Usuario`
  - Reporte de sesiones activas y cerradas, con IP, dispositivo, geografía y fecha de inicio.

- [ ] `Cierres Remotos de Sesion`
  - Mide revocaciones manuales o administrativas de sesiones.

- [ ] `Accesos por Dispositivo y Ubicacion`
  - Consolida accesos por origen, dispositivo y patrón de uso.

- [ ] `Anomalias Basicas de Sesion`
  - Señala comportamientos atípicos definidos para revisión manual.

## 2. Auditoria de Seguridad y Eventos Sensibles

- [ ] `Cambios de Password`
  - Consolida cambios de contraseña ejecutados por usuario o por administración.

- [ ] `Eventos Sensibles de Cuenta`
  - Mide acciones sensibles relacionadas con identidad, sesión y credenciales.

- [ ] `Actividad de Auditoria Disponible`
  - Consolidado de eventos auditados hoy disponibles en el sistema.

- [ ] `Eventos Sensibles por Usuario`
  - Agrupa actividad crítica por usuario para revisión administrativa.

## 3. Auditoria de Acceso Externo a Minutas

- [ ] `Solicitudes OTP para Acceso a Minutas`
  - Reporte sobre solicitudes de códigos de acceso para participantes invitados.

- [ ] `Sesiones de Invitados`
  - Consolida sesiones emitidas para revisión externa de minutas.

- [ ] `Observaciones Externas como Evidencia`
  - Vista de observaciones externas desde óptica de trazabilidad y evidencia, no de operación editorial.

- [ ] `Accesos Externos por Minuta`
  - Resume qué minutas tuvieron acceso externo y qué nivel de actividad registraron.

## 4. Auditoria de Cambios

- [ ] `Cambios Auditados Disponibles`
  - Reporte sobre cambios actualmente cubiertos por el sistema de auditoría.

- [ ] `Cambios por Entidad`
  - Agrupa eventos auditados por tipo de entidad.

- [ ] `Cambios por Actor`
  - Agrupa eventos auditados por usuario que ejecutó la acción.

- [ ] `Cambios por Periodo`
  - Permite revisión histórica por ventanas temporales.

Nota:
Este frente debe reflejar solo la cobertura real del sistema. Si hoy la auditoría está más cargada a auth/sesiones que al resto del CRUD, el reporte debe decirlo con claridad.

## 5. Auditoria de Sistema y Gobierno

- [ ] `Eventos de Sistema Relevantes`
  - Consolida alertas y eventos de sistema que tengan valor de control y revisión.

- [ ] `Alertas con Impacto de Control`
  - Filtra eventos operativos que requieran tratamiento desde gobierno o auditoría.

- [ ] `Trazabilidad de Providers IA`
  - Vista de validaciones, errores y cambios desde óptica de control, no de gestión operativa.

## Priorizacion Sugerida

### Fase 1

- [ ] `Sesiones de Usuario`
- [ ] `Cierres Remotos de Sesion`
- [ ] `Cambios de Password`
- [ ] `Actividad de Auditoria Disponible`
- [ ] `Solicitudes OTP para Acceso a Minutas`
- [ ] `Sesiones de Invitados`

### Fase 2

- [ ] `Eventos Sensibles de Cuenta`
- [ ] `Cambios por Entidad`
- [ ] `Cambios por Actor`
- [ ] `Accesos Externos por Minuta`
- [ ] `Eventos de Sistema Relevantes`

### Fase 3

- [ ] `Anomalias Basicas de Sesion`
- [ ] `Observaciones Externas como Evidencia`
- [ ] `Alertas con Impacto de Control`
- [ ] `Trazabilidad de Providers IA`

## Checklist de Implementacion por Reporte

- [ ] Definicion funcional validada
- [ ] Cobertura real de datos confirmada
- [ ] Nombre final aprobado
- [ ] Endpoint backend disponible
- [ ] Query o agregacion validada
- [ ] Pantalla frontend creada
- [ ] Filtros implementados
- [ ] Exportacion implementada
- [ ] Validacion manual completada
- [ ] Documentacion interna actualizada
