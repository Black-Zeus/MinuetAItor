# 00 - Estrategia general

## Objetivo
Construir una practica de testing proporcional al riesgo del producto.

MinuetAItor no necesita partir con una suite enorme. Necesita partir con pruebas que protejan los flujos que romperian una demo, un piloto o datos de cliente.

## Capas de pruebas

### 1. Pruebas manuales guiadas
Son checklists paso a paso.

Sirven para:
- validar flujos aun inestables,
- detectar friccion de UX,
- probar integraciones reales dentro de Docker.

### 2. Smoke tests
Pruebas cortas que responden: "el sistema vive y los flujos principales no estan rotos".

Ejemplos:
- login exitoso,
- `/auth/me` responde,
- listar minutas,
- crear cliente,
- crear minuta con archivo pequeno,
- consultar estado de job.

### 3. Pruebas de contrato
Validan que productor y consumidor hablen el mismo idioma.

Ejemplos:
- frontend envia campos que backend espera,
- backend responde con estructura estable,
- worker recibe job Redis con `type` y payload correctos,
- PDF worker recibe job con campos obligatorios.

### 4. Pruebas de permisos
Validan que cada rol pueda hacer solo lo que corresponde.

Ejemplos:
- usuario sin permiso no crea minuta,
- usuario sin acceso a cliente no ve sus minutas,
- admin accede a configuracion sistema,
- viewer no ejecuta mutaciones administrativas.

### 5. Pruebas E2E
Validan un flujo completo como usuario real.

Ejemplos:
- login -> crear cliente -> crear proyecto -> generar minuta -> revisar -> publicar.

## Prioridad recomendada
1. Auth y sesiones.
2. RBAC y scopes cliente/proyecto.
3. Minutas.
4. Workers y jobs.
5. PDF y artefactos.
6. Reportes criticos.
7. Configuracion sistema.
8. Onboarding/demo.

## Politica inicial
- Cada bug corregido debe transformarse en caso de prueba documentado.
- Cada cambio de contrato debe actualizar pruebas de contrato.
- Cada endpoint administrativo debe tener caso permitido y caso denegado.
- Cada flujo critico debe tener evidencia de validacion antes de promocion.
- Las pruebas automaticas que consumen IA deben preferir datasets `mini` o `simple`; `normal` y `extenso` se ejecutan solo bajo demanda directa para controlar consumo de tokens.
