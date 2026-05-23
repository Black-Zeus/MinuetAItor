# REPORTES DE GESTION TODO

Checklist maestro de reportes de gestion para MinuetAItor.

## Scope

Estos reportes cubren:
- gestion administrativa
- gestion operativa
- gestion ejecutiva
- trazabilidad documental
- actividad funcional del sistema
- exportacion transversal a PDF y CSV/Excel para cada reporte

No cubren:
- auditoria formal
- compliance
- seguridad forense
- evidencia regulatoria

Estado sugerido:
- `[ ]` No iniciado
- `[/]` En progreso
- `[x]` Listo
- `[-]` Postergado

## 1. Resumen Ejecutivo

- [ ] `Resumen Ejecutivo General`
  - Vista consolidada para gerencia con volumen de minutas, clientes activos, proyectos con actividad documental, minutas publicadas, backlog pendiente y tendencia del periodo.

- [ ] `Resumen Ejecutivo por Cliente`
  - Muestra actividad documental, carga operativa, volumen de minutas, revisión y uso de IA por cliente.

- [ ] `Resumen Ejecutivo por Proyecto`
  - Muestra actividad documental y operacional asociada a un proyecto como agrupador de minutas.

## 2. Produccion de Minutas

- [ ] `Produccion de Minutas`
  - Reporte principal de operación: cuántas minutas entran, cuántas se procesan, cuántas se publican y cuántas quedan detenidas por estado.

- [ ] `Minutas por Estado`
  - Desglose de minutas en `in-progress`, `ready-for-edit`, `pending`, `preview`, `completed`, `cancelled` y estados de error.

- [ ] `Minutas por Elaborador`
  - Mide carga documental y volumen de trabajo por usuario responsable de preparación.

- [ ] `Minutas por Cliente`
  - Permite identificar qué clientes concentran más actividad documental.

- [ ] `Minutas por Proyecto`
  - Permite ver qué proyectos concentran más minutas sin tratarlo como avance real de proyecto.

- [ ] `Tiempos de Ciclo de Minutas`
  - Calcula cuánto tarda una minuta desde su ingreso hasta quedar lista para edición, revisión y publicación final.

- [ ] `Minutas con Reproceso`
  - Identifica minutas que fallaron, requirieron reproceso o quedaron atrapadas en estados intermedios.

## 3. Requerimientos, Acuerdos y Compromisos Declarados

- [ ] `Seguimiento Documental de Acuerdos`
  - Lista acuerdos extraídos de minutas, su responsable, fecha declarada y estado documental registrado.

- [ ] `Compromisos con Fecha Expirada`
  - Reporte de compromisos con fecha declarada ya expirada y que siguen figurando como pendientes en el registro documental.

- [ ] `Compromisos por Responsable`
  - Muestra concentración de compromisos declarados por persona para análisis de carga documental.

- [ ] `Requerimientos por Prioridad`
  - Ordena requerimientos detectados en minutas según prioridad y estado registrado.

- [ ] `Requerimientos y Compromisos por Cliente`
  - Resume seguimiento declarado agrupado por cliente.

- [ ] `Requerimientos y Compromisos por Proyecto`
  - Resume seguimiento declarado agrupado por proyecto como contenedor documental.

Nota:
Estos reportes representan seguimiento declarado en actas. No validan cumplimiento real en terreno ni control efectivo de avance del proyecto.

## 4. Revision, Publicacion y Observaciones

- [ ] `Minutas en Revision`
  - Muestra todas las minutas actualmente en `preview`, con foco en control editorial.

- [ ] `Observaciones Externas Recibidas`
  - Lista observaciones hechas por participantes invitados desde la vista pública o de revisión.

- [ ] `Resolucion de Observaciones`
  - Resume observaciones `new`, `inserted`, `approved` y `rejected`, incluyendo tiempos de respuesta editorial.

- [ ] `Minutas con Mayor Friccion de Revision`
  - Detecta minutas con más observaciones, más iteraciones o más demora antes de publicarse.

- [ ] `Publicaciones Finalizadas`
  - Registro de minutas que llegaron a `completed`, quién publicó y cuándo.

- [ ] `Correos de Revision y Publicacion`
  - Mide envío automático o manual de correos asociados al flujo editorial.

## 5. Clientes y Proyectos como Contexto Documental

- [x] `Cartera de Clientes`
  - Reporte administrativo con clientes activos, prioridad, confidencialidad y volumen de actividad documental asociada.

- [x] `Cartera de Proyectos`
  - Reporte consolidado de proyectos activos, confidenciales, con automatizaciones de envío y nivel de actividad documental.

- [x] `Clientes sin Actividad Documental Reciente`
  - Identifica clientes sin minutas recientes para seguimiento operativo o comercial.

- [x] `Proyectos sin Actividad Documental Reciente`
  - Identifica proyectos sin minutas recientes.

- [x] `Clientes con Mayor Carga Documental`
  - Prioriza cuentas con más minutas, observaciones, revisión o consumo de IA.

- [x] `Proyectos con Mayor Carga Documental`
  - Permite ver los proyectos más intensivos en actividad documental, revisión y uso de plataforma.

## 6. Uso, Costo y Rendimiento de IA

- [ ] `Uso General de IA`
  - Resumen de eventos IA, volumen total, éxito, fallos, tokens, costo estimado y latencia promedio.

- [ ] `Costo de IA por Cliente`
  - Cuánto gasto estimado de IA se está destinando a cada cliente.

- [ ] `Costo de IA por Proyecto`
  - Permite imputar costo tecnológico a proyectos como agrupador documental.

- [ ] `Costo de IA por Modelo`
  - Compara consumo y costo entre modelos usados por el sistema.

- [ ] `Costo de IA por Proveedor`
  - Contrasta proveedores o adapters según costo, éxito y rendimiento.

- [ ] `Latencia y Exito por Modelo`
  - Reporte técnico para decidir si un modelo es estable, rápido y rentable.

- [ ] `Uso de IA por Perfil`
  - Muestra qué perfiles de análisis IA son los más usados y cuáles generan más carga.

- [ ] `Eventos IA con Error`
  - Foco en observabilidad: eventos fallidos, timeout, cancelados y causas de error.

## 7. Salud Operativa de Plataforma

- [x] `Estado de Colas`
  - Reporte de tamaño, umbrales, alertas y actividad de `queue:minutes`, `queue:pdf`, `queue:maintenance`, `queue:email` y `queue:dlq`.

- [x] `Backlog Operacional`
  - Vista orientada a gerencia y operación sobre acumulación de trabajo y riesgo de demora.

- [x] `Fallos de Procesamiento`
  - Identifica transacciones fallidas, minutas con error y patrones de falla.

- [x] `Reprocesos y Recuperacion`
  - Controla cuántos flujos necesitaron reintento y con qué resultado.

- [x] `Validacion de Providers IA`
  - Reporte administrativo sobre proveedores activos, estado de validación y últimos errores.

- [x] `Alertas del Sistema`
  - Consolida eventos importantes de mantenimiento, umbrales y recuperación.

## 8. Etiquetas y Analitica Tematica

- [ ] `Minutas por Tag`
  - Distribución por etiquetas funcionales o de negocio para análisis temático.

- [ ] `Tags AI Detectados`
  - Muestra qué etiquetas sugeridas por IA aparecen con mayor frecuencia.

- [ ] `Conversion AI Tag -> Tag Operacional`
  - Permite medir la utilidad real del etiquetado IA y su mapeo al catálogo operativo.

- [ ] `Tendencias Tematicas`
  - Detecta qué temas, áreas o tipos de reuniones están creciendo en frecuencia.

Nota:
La exportacion no se maneja como seccion independiente. Cada reporte debe considerar exportacion propia a PDF y a CSV/Excel.

## Priorizacion Sugerida

### Fase 1: Alta factibilidad inmediata

- [ ] `Resumen Ejecutivo General`
- [ ] `Produccion de Minutas`
- [ ] `Minutas por Estado`
- [ ] `Minutas por Elaborador`
- [ ] `Minutas por Cliente`
- [ ] `Minutas en Revision`
- [ ] `Observaciones Externas Recibidas`
- [ ] `Resolucion de Observaciones`
- [ ] `Uso General de IA`
- [ ] `Costo de IA por Cliente`
- [ ] `Costo de IA por Proyecto`
- [ ] `Estado de Colas`
- [ ] `Fallos de Procesamiento`

### Fase 2: Alto valor con ajuste de modelo o agregacion

- [ ] `Seguimiento Documental de Acuerdos`
- [ ] `Compromisos con Fecha Expirada`
- [ ] `Compromisos por Responsable`
- [ ] `Requerimientos por Prioridad`
- [ ] `Requerimientos y Compromisos por Cliente`
- [ ] `Requerimientos y Compromisos por Proyecto`
- [ ] `Minutas con Mayor Friccion de Revision`
- [ ] `Minutas por Tag`
- [ ] `Tags AI Detectados`

### Fase 3: Reporteria madura

- [ ] `Clientes con Mayor Carga Documental`
- [ ] `Proyectos con Mayor Carga Documental`
- [ ] `Latencia y Exito por Modelo`
- [ ] `Uso de IA por Perfil`
- [ ] `Tendencias Tematicas`

## Checklist de Implementacion por Reporte

- [ ] Definicion funcional validada
- [ ] Nombre final aprobado
- [ ] Fuente de datos identificada
- [ ] Endpoint backend disponible
- [ ] Query o agregacion validada
- [ ] Pantalla frontend creada
- [ ] Filtros implementados
- [ ] Exportacion PDF implementada
- [ ] Exportacion CSV/Excel implementada
- [ ] Validacion manual completada
- [ ] Documentacion interna actualizada
