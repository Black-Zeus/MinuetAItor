# REPORTS TODO

Definicion maestra de tipos de reportes para MinuetAItor.

## Clasificacion Oficial

Por ahora, MinuetAItor tendra solo `2` macro tipos de reportes:

1. `Reportes de Gestion`
2. `Reportes de Auditoria`

No se define un tercer tipo por ahora.

## Regla de Separacion

### 1. Reportes de Gestion

Incluyen:
- reportes administrativos
- reportes operacionales
- reportes ejecutivos
- reportes de actividad documental
- reportes de uso funcional de la plataforma
- reportes de productividad del flujo de minutas
- reportes de uso y costo de IA
- reportes de salud operativa si su foco es gestion y operacion
- exportacion transversal a PDF y CSV/Excel dentro de cada reporte

Archivo asociado:
- [REPORTS_GESTION_TODO.md](/home/vsoto/Proyectos/MinuetAItor/REPORTS_GESTION_TODO.md)

### 2. Reportes de Auditoria

Incluyen:
- auditoria de accesos
- auditoria de sesiones
- auditoria de cambios
- trazabilidad de acciones sensibles
- evidencia para compliance o control
- reportes de seguridad formal
- reportes con foco forense o regulatorio

Archivo asociado:
- [REPORTS_AUDITORIA_TODO.md](/home/vsoto/Proyectos/MinuetAItor/REPORTS_AUDITORIA_TODO.md)

## Nota sobre un posible tercer grupo

Si en el futuro crece mucho la observabilidad tecnica, se podria separar un tercer dominio:
- `Observabilidad / Plataforma`

Pero por ahora no conviene abrirlo como categoria independiente.

Regla temporal:
- si el foco es operacion y gestion diaria, va en `Gestion`
- si el foco es control, evidencia, seguridad o trazabilidad formal, va en `Auditoria`

## Alcance funcional actual

MinuetAItor hoy:
- gestiona minutas
- separa requerimientos, acuerdos y compromisos declarados
- registra revision, publicacion, observaciones y actividad de IA
- usa clientes y proyectos como contexto documental

MinuetAItor hoy no:
- gestiona la ejecucion real del proyecto de punta a punta
- valida cumplimiento real de compromisos fuera de lo declarado en las minutas

## Decision vigente

- [x] Solo existen `2` macro tipos oficiales de reportes
- [x] `Gestion` y `Auditoria` quedan separados
- [x] No se abre un tercer tipo por ahora
