# Reportes de Auditoria Pendientes

Este documento lista solo los reportes de auditoria que aun faltan por implementar, ordenados desde el mas simple al mas complejo segun las fuentes disponibles hoy y el nivel de logica adicional requerida.

## 1. Accesos por Dispositivo y Ubicacion

Consolida sesiones de usuario por dispositivo, IP, pais, ciudad o ubicacion registrada.

Complejidad: baja.
La informacion ya existe en `user_sessions`: `device`, `ip_v4`, `ip_v6`, `country_name`, `city`, `location` y `created_at`. Requiere principalmente una agregacion sobre sesiones y una vista orientada a distribucion, sin crear nuevas tablas.

## 2. Eventos Sensibles por Usuario

Agrupa eventos criticos por actor para identificar usuarios con mayor actividad sensible.

Complejidad: baja-media.
Ya existe `audit_log` con `actor_user_id`, `action`, `entity_type` y `event_at`. La dificultad esta en definir una lista estable de acciones sensibles y evitar mezclar acciones administrativas menores con evidencia critica.

## 3. Eventos Sensibles de Cuenta

Lista acciones relevantes sobre identidad, sesiones y credenciales, como cambios de password, cierres remotos y revocaciones.

Complejidad: media.
Parte de la informacion ya esta en `audit_log`, pero requiere una clasificacion funcional de acciones sensibles. Tambien conviene normalizar mensajes y severidades para que el reporte sea entendible por auditoria y no una lista de codigos internos.

## 4. Eventos de Sistema Relevantes

Consolida eventos operativos del sistema que tengan valor de control, por ejemplo rutinas manuales, mantenimiento, limpieza de sesiones o procesos administrativos relevantes.

Complejidad: media.
Existen fuentes parciales en mantenimiento, eventos internos y auditoria, pero no todo se registra bajo una misma estructura. Requiere definir que eventos cuentan como evidencia de gobierno y desde que tabla o servicio se obtienen.

## 5. Alertas con Impacto de Control

Filtra alertas operativas que requieren revision desde gobierno o auditoria, por ejemplo fallas repetidas, colas sobre umbral, procesos detenidos o recuperaciones manuales.

Complejidad: media-alta.
La plataforma ya posee monitoreo operativo, pero el reporte necesita reglas de impacto: que alerta es solo operativa y cual tiene valor de control. Probablemente requiera consolidar estados de colas, mantenimiento y fallos en una salida comun.

## 6. Anomalias Basicas de Sesion

Detecta patrones atipicos de acceso: multiples IPs, sesiones simultaneas inusuales, ubicaciones cambiantes o actividad fuera de patrones esperados.

Complejidad: alta.
Aunque `user_sessions` contiene la base, el reporte no es una simple consulta. Requiere reglas de deteccion, umbrales, ventanas temporales y una definicion clara de que se considera anomalia para evitar falsos positivos.

## 7. Trazabilidad de Providers IA

Presenta validaciones, cambios, errores y uso de providers IA desde una mirada de control.

Complejidad: alta.
Hay informacion en configuraciones de providers y metricas IA, pero la trazabilidad de control exige distinguir cambios administrativos, validaciones tecnicas, fallos y uso operacional. Puede requerir ampliar auditoria de configuraciones o persistir eventos especificos que hoy no necesariamente quedan como evidencia formal.
