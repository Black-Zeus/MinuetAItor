# Propuesta de Trazabilidad de Estados para Minutas

## Objetivo

Habilitar el reporte `Tiempos de Ciclo de Minutas` con una fuente explícita, clara y no ambigua sobre cada transición real del flujo documental.

La idea es dejar de inferir tiempos desde `records.updated_at`, `record_versions.published_at` o `minute_transactions.completed_at`, porque esos campos ayudan como contexto operativo, pero no representan por sí solos una línea de tiempo completa del ciclo editorial.

## Problema actual

Hoy el sistema sí tiene:

- `records.created_at`
- `minute_transactions.created_at`
- `minute_transactions.updated_at`
- `minute_transactions.completed_at`
- `record_versions.published_at`
- `record_drafts.updated_at`

Pero no existe una tabla dedicada que registre cada cambio de estado del `record`.

Eso hace ambiguo responder preguntas como:

- cuánto tardó una minuta en pasar de `in-progress` a `ready-for-edit`
- cuánto tiempo pasó en edición (`pending`)
- cuánto tiempo permaneció en revisión (`preview`)
- cuánto demoró desde su creación hasta `completed`
- cuántas veces volvió de `preview` a `pending`

## Propuesta de nueva tabla

Nombre sugerido:

- `record_status_transitions`

## Estructura sugerida

```sql
CREATE TABLE record_status_transitions (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_id             CHAR(36) NOT NULL,
  minute_transaction_id CHAR(36) NULL,
  record_version_id     CHAR(36) NULL,
  from_status_id        SMALLINT UNSIGNED NULL,
  to_status_id          SMALLINT UNSIGNED NOT NULL,
  changed_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by            CHAR(36) NULL,
  source                VARCHAR(40) NOT NULL,
  transition_reason     VARCHAR(80) NULL,
  metadata_json         JSON NULL,
  PRIMARY KEY (id),
  KEY idx_rst_record_changed_at (record_id, changed_at),
  KEY idx_rst_to_status_changed_at (to_status_id, changed_at),
  KEY idx_rst_tx (minute_transaction_id),
  KEY idx_rst_version (record_version_id),
  KEY idx_rst_actor (changed_by),
  CONSTRAINT fk_rst_record FOREIGN KEY (record_id) REFERENCES records(id),
  CONSTRAINT fk_rst_tx FOREIGN KEY (minute_transaction_id) REFERENCES minute_transactions(id),
  CONSTRAINT fk_rst_version FOREIGN KEY (record_version_id) REFERENCES record_versions(id),
  CONSTRAINT fk_rst_from_status FOREIGN KEY (from_status_id) REFERENCES record_statuses(id),
  CONSTRAINT fk_rst_to_status FOREIGN KEY (to_status_id) REFERENCES record_statuses(id),
  CONSTRAINT fk_rst_actor FOREIGN KEY (changed_by) REFERENCES users(id)
);
```

## Semántica recomendada de columnas

- `record_id`
  Minuta afectada.

- `minute_transaction_id`
  Referencia opcional cuando el cambio viene del procesamiento IA o de un reproceso.

- `record_version_id`
  Referencia opcional cuando la transición crea o consolida una versión relevante.

- `from_status_id`
  Estado anterior. Puede ser `NULL` solo para la creación inicial del record.

- `to_status_id`
  Estado nuevo efectivo.

- `changed_at`
  Fecha UTC exacta en que el sistema confirma la transición.

- `changed_by`
  Usuario que provocó el cambio cuando aplica. Puede ser `NULL` para eventos puramente automáticos.

- `source`
  Origen técnico del cambio. Valores sugeridos:
  - `minute.generate`
  - `worker.processing`
  - `minute.transition`
  - `minute.reprocess`
  - `system.auto`

- `transition_reason`
  Motivo corto del cambio. Ejemplos:
  - `initial-create`
  - `ai-processing-success`
  - `ai-processing-failed`
  - `manual-open-editor`
  - `sent-to-review`
  - `returned-to-edit`
  - `published`
  - `manual-cancel`
  - `manual-reprocess`
  - `stale-processing-recovery`

- `metadata_json`
  Contexto adicional opcional. Ejemplos:
  - `{"autoSendOnPreview": true}`
  - `{"reprocessReason": "stale-processing"}`
  - `{"commitMessage": "..."}`

## Reglas para que el dato no sea ambiguo

### 1. La transición se registra en la misma transacción DB

Cada vez que cambie `record.status_id`, la inserción en `record_status_transitions` debe ocurrir dentro del mismo `db.commit()`.

Eso evita:

- estados cambiados sin evidencia histórica
- filas históricas insertadas si luego el cambio real falla

### 2. No inferir desde timestamps secundarios

El reporte de ciclo no debe usar como fuente principal:

- `records.updated_at`
- `record_drafts.updated_at`
- `record_versions.published_at`
- `minute_transactions.completed_at`

Esos campos pueden servir como apoyo o validación, pero no como línea de tiempo oficial del ciclo.

### 3. Registrar también regresiones

Debe registrarse no solo avance, sino cualquier retroceso, por ejemplo:

- `preview -> pending`
- `in-progress -> cancelled`
- `preview -> cancelled`

Eso permite medir fricción y vueltas editoriales reales.

### 4. Registrar la transición inicial

Cuando se crea una minuta nueva:

- `from_status_id = NULL`
- `to_status_id = in-progress`
- `source = minute.generate`
- `transition_reason = initial-create`

Sin eso, el ciclo total queda truncado desde el origen.

### 5. Nunca sobreescribir historia

La tabla debe ser append-only.  
No se deben editar filas históricas para “corregir” estados.

Si un flujo cambia nuevamente, se agrega una nueva fila.

## Puntos exactos donde escribir la transición

### A. Creación inicial de minuta

Archivo:

- [generate.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/services/minutes/generate.py:180)

Evento:

- `NULL -> in-progress`

### B. Resultado del procesamiento IA

Archivo:

- [internal_minutes_service.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/services/internal_minutes_service.py:213)

Eventos:

- `in-progress -> ready-for-edit`
- `in-progress -> llm-failed`
- `in-progress -> processing-error`

### C. Transiciones editoriales manuales

Archivo:

- [minutes_service.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/services/minutes_service.py:850)

Eventos:

- `ready-for-edit -> pending`
- `pending -> preview`
- `preview -> completed`
- `preview -> pending`
- `* -> cancelled`
- `* -> deleted`

### D. Reproceso manual

Archivo:

- [reprocess.py](/home/vsoto/Proyectos/MinuetAItor/APP/volumes/backend/app/services/minutes/reprocess.py:252)

Evento:

- `llm-failed|processing-error|in-progress(stale) -> in-progress`

Aquí conviene además guardar:

- `minute_transaction_id` de la nueva transacción
- `transition_reason` con el valor de `reprocess_reason`

## Helper recomendado

Crear un helper único, por ejemplo:

- `services/minutes/status_transitions.py`

Firma sugerida:

```python
def append_record_status_transition(
    db: Session,
    *,
    record_id: str,
    from_status_id: int | None,
    to_status_id: int,
    changed_by: str | None,
    source: str,
    transition_reason: str | None = None,
    minute_transaction_id: str | None = None,
    record_version_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    ...
```

Beneficios:

- evita duplicar lógica en varios servicios
- normaliza `source` y `transition_reason`
- reduce riesgo de olvidar la auditoría en una transición

## Qué reportes habilita esta tabla

### Directamente

- `Tiempos de Ciclo de Minutas`
- `Minutas con Mayor Fricción de Revisión`
- `Publicaciones Finalizadas`

### Indirectamente

- métricas de SLA editorial
- tiempo promedio de IA vs edición vs revisión
- cantidad de regresiones `preview -> pending`
- duración por cliente, proyecto o responsable

## Métricas que quedarían claras con esta tabla

- tiempo medio `in-progress -> ready-for-edit`
- tiempo medio `ready-for-edit -> pending`
- tiempo medio `pending -> preview`
- tiempo medio `preview -> completed`
- ciclo total `created -> completed`
- cantidad de reingresos a edición
- minutas con más de un paso por `preview`

## Recomendación de rollout

### Fase 1

- crear la tabla
- crear helper central
- instrumentar todos los puntos de transición nuevos desde ahora en adelante

### Fase 2

- construir el reporte `Tiempos de Ciclo de Minutas`
- dejar explícito que la métrica formal aplica desde la fecha de activación de esta tabla

### Fase 3 opcional

- evaluar backfill parcial desde datos históricos
- solo si negocio realmente necesita retrospectiva

No recomiendo invertir tiempo en backfill completo salvo requerimiento explícito, porque el estado histórico previo no puede reconstruirse de forma totalmente confiable con la estructura actual.
