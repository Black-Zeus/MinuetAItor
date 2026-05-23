# Reportes Pendientes de Esta Pasada

## Implementados en esta tanda

- Resumen Ejecutivo General
- Resumen Ejecutivo por Cliente
- Resumen Ejecutivo por Proyecto
- Producción de Minutas
- Minutas por Estado
- Minutas por Elaborador
- Minutas por Cliente
- Minutas por Proyecto
- Minutas en Revisión

## Pendientes de gestión

### Producción de Minutas

- Tiempos de Ciclo de Minutas
  Motivo: requiere timestamps de transición por etapa para medir duración real entre procesamiento, edición, revisión y publicación.

- Minutas con Reproceso
  Motivo: requiere eventos o marcas explícitas de reintento/error por minuta; la fuente actual de minutas no expone ese historial.

### Requerimientos y Compromisos

- Seguimiento Documental de Acuerdos
- Compromisos con Fecha Expirada
- Compromisos por Responsable
- Requerimientos por Prioridad
- Requerimientos y Compromisos por Cliente
- Requerimientos y Compromisos por Proyecto
  Motivo: requieren una fuente estructurada y estable de acuerdos, compromisos, prioridades, vencimientos y responsables extraídos desde minutas. En esta pasada no existe un endpoint consolidado listo para reportería reusable.

### Revisión y Publicación

- Observaciones Externas Recibidas
- Resolución de Observaciones
- Minutas con Mayor Fricción de Revisión
- Publicaciones Finalizadas
- Correos de Revisión y Publicación
  Motivo: requieren integrar observaciones externas, hitos editoriales, evidencia de publicación y eventos de correo. Hoy esa información no está consolidada en una sola fuente operacional apta para estos reportes.

### Clientes y Proyectos

- Cartera de Clientes
- Cartera de Proyectos
- Clientes sin Actividad Documental Reciente
- Proyectos sin Actividad Documental Reciente
- Clientes con Mayor Carga Documental
- Proyectos con Mayor Carga Documental
  Motivo: aunque parte del dato base existe, faltan definiciones cerradas de negocio para distinguir cartera, inactividad reciente y carga documental con el criterio exacto esperado por negocio.

### Uso y Costo de IA

- Uso General de IA
- Costo de IA por Cliente
- Costo de IA por Proyecto
- Costo de IA por Modelo
- Costo de IA por Proveedor
- Latencia y Éxito por Modelo
- Uso de IA por Perfil
- Eventos IA con Error
  Motivo: requieren fuentes transaccionales de uso, costos, latencias, perfiles y errores de IA que no están conectadas todavía al módulo reutilizable de reportes de gestión.

### Salud Operativa

- Estado de Colas
- Backlog Operacional
- Fallos de Procesamiento
- Reprocesos y Recuperación
- Validación de Providers IA
- Alertas del Sistema
  Motivo: requieren leer colas, métricas operativas, alertas y validaciones técnicas del stack. Esa capa existe en otros componentes del sistema, pero no como dataset estable consumible desde esta fábrica de reportes.

### Etiquetas y Tendencias

- Minutas por Tag
- Tags AI Detectados
- Conversión AI Tag -> Tag Operacional
- Tendencias Temáticas
  Motivo: requieren catálogos y relaciones de etiquetas todavía no expuestos en una consulta homogénea para reportería consolidada.

## Auditoría

- Toda la reportería de auditoría quedó fuera de esta pasada.
  Motivo: decisión explícita de alcance para concentrar primero la reportería de gestión factible con la misma estructura, exportación y PDF del primer reporte.
