/* 40_seeds_minimal.sql */

-- ----------------------------------------------------------------------------
-- Roles base
-- ----------------------------------------------------------------------------
INSERT INTO roles (code, name, description, is_active) VALUES
  ('ADMIN',   'Administrador', 'Acceso total a la plataforma', 1),
  ('EDITOR',  'Editor',        'Crea/edita/publica documentos', 1),
  ('VIEWER',  'Lector',        'Solo lectura', 1),
  ('DELETER', 'Eliminador',    'Permite hard delete bajo auditoría', 1);

-- ----------------------------------------------------------------------------
-- Permisos base (ampliable)
-- ----------------------------------------------------------------------------
INSERT INTO permissions (code, name, description, is_active) VALUES
  ('records.read',         'Leer documentos', 'Puede listar/ver documentos y versiones', 1),
  ('records.create',       'Crear documentos', 'Puede crear registros y drafts', 1),
  ('records.update',       'Editar documentos', 'Puede modificar cabeceras y drafts', 1),
  ('records.publish',      'Publicar documentos', 'Puede publicar (genera versión+PDF)', 1),
  ('records.soft_delete',  'Soft delete documentos', 'Puede dar de baja lógica registros', 1),
  ('records.hard_delete',  'Hard delete documentos', 'Puede eliminar físicamente (auditoría obligatoria)', 1),
  ('users.manage',         'Administrar usuarios', 'CRUD/roles/estado de usuarios', 1),
  ('clients.manage',       'Administrar clientes', 'CRUD/estado de clientes', 1),
  ('audit.read',           'Leer auditoría', 'Puede consultar audit_log', 1);

-- ADMIN: todo
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code='ADMIN' AND p.is_active=1;

-- EDITOR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p
  ON p.code IN ('records.read','records.create','records.update','records.publish','audit.read')
WHERE r.code='EDITOR';

-- VIEWER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p
  ON p.code IN ('records.read','audit.read')
WHERE r.code='VIEWER';

-- DELETER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p
  ON p.code IN ('records.read','records.soft_delete','records.hard_delete','audit.read')
WHERE r.code='DELETER';

-- ----------------------------------------------------------------------------
-- Record types
-- ----------------------------------------------------------------------------
INSERT INTO record_types (code, name, description, is_active) VALUES
  ('MINUTE',  'Minuta',     'Minutas de reunión', 1),
  ('REPORT',  'Informe',    'Informes técnicos/operativos', 1),
  ('EXPENSE', 'Rendición',  'Rendiciones de cuenta', 1);

-- Record statuses
INSERT INTO record_statuses (code, name, description, is_active) VALUES
  ('ACCEPTED',        'Aceptado',        'Estado por defecto', 1),
  ('NON_PRODUCIBLE',  'No producible',   'No debe emitirse/publicarse', 1),
  ('OBSOLETE',        'Obsoleto',        'Reemplazado por reprocesamiento', 1);

-- Version statuses
INSERT INTO version_statuses (code, name, description, is_active) VALUES
  ('PUBLISHED',   'Publicado',   'Versión vigente/publicada', 1),
  ('SUPERSEDED',  'Reemplazado', 'Reemplazada por una posterior', 1),
  ('REVOKED',     'Revocado',    'No vigente por decisión administrativa', 1);

-- Artifact states
INSERT INTO artifact_states (code, name, description, is_active) VALUES
  ('DRAFT',     'Borrador',   'Artefacto del draft vigente', 1),
  ('PUBLISHED', 'Publicado',  'Artefacto de versión publicada', 1),
  ('ARCHIVED',  'Archivado',  'Artefacto histórico/no vigente', 1);

-- Artifact types
INSERT INTO artifact_types (code, name, description, is_active) VALUES
  ('INPUT_TRANSCRIPT',   'Transcripción',        'Input transcripción (txt)', 1),
  ('INPUT_SUMMARY',      'Resumen',             'Input resumen (txt)', 1),
  ('LLM_JSON_ORIGINAL',  'JSON LLM Original',   'JSON original devuelto por LLM (sin edición)', 1),
  ('CANONICAL_JSON',     'JSON Canonical',      'JSON confirmado/editable que origina la publicación', 1),
  ('PUBLISHED_PDF',      'PDF Publicado',       'Documento final publicado (PDF)', 1),
  ('ATTACHMENT_IMAGE',   'Imagen Adjunta',      'Adjuntos (imágenes/otros)', 1);

-- Buckets MinIO
INSERT INTO buckets (code, name, description, is_active) VALUES
  ('inputs_container',      'minuetaitor-inputs',     'Entradas (transcripción/resumen)', 1),
  ('json_container',        'minuetaitor-json',       'JSONs (original/canonical)', 1),
  ('published_container',   'minuetaitor-published',  'Salidas publicadas (PDF)', 1),
  ('attachments_container', 'minuetaitor-attach',     'Adjuntos (imágenes/otros)', 1);

-- ----------------------------------------------------------------------------
-- Dashboard widgets base (alineado a tu DASHBOARD_WIDGETS_DEFAULT)
-- ----------------------------------------------------------------------------
INSERT INTO dashboard_widgets (code, name, description, is_active) VALUES
  ('stats', 'Stats generales', 'KPIs principales', 1),
  ('ultima_conexion', 'Última conexión', 'Último acceso del usuario', 1),
  ('minutas_pendientes', 'Minutas pendientes', 'Pendientes de aprobación', 1),
  ('minutas_participadas', 'Minutas donde participé', 'Historial de participación', 1),
  ('clientes_confidenciales', 'Clientes confidenciales', 'Clientes con acceso confidencial', 1),
  ('proyectos_confidenciales', 'Proyectos confidenciales', 'Proyectos con acceso confidencial', 1),
  ('tags_populares', 'Etiquetas populares', 'Tags más usados', 1);

-- ----------------------------------------------------------------------------
-- IA: categorías base (puedes ampliarlas desde analysisProfilesCatalog.json)
-- ----------------------------------------------------------------------------
INSERT INTO ai_profile_categories (name, is_active) VALUES
  ('Infraestructura', 1),
  ('Ciberseguridad', 1),
  ('Operaciones', 1),
  ('Gestión', 1);

-- ----------------------------------------------------------------------------
-- Tags: categorías base (puedes ampliarlas desde dataTags.json)
-- ----------------------------------------------------------------------------
INSERT INTO tag_categories (name, is_active) VALUES
  ('Infraestructura', 1),
  ('Seguridad', 1),
  ('Aplicaciones', 1),
  ('Procesos', 1),
  ('Otros', 1);

-- Reglas: requeridos al publicar (por tipo)
INSERT INTO record_type_artifact_types (record_type_id, artifact_type_id, is_required_on_publish, max_count, is_active)
SELECT rt.id, at.id, 1, 1, 1
FROM record_types rt
JOIN artifact_types at ON at.code IN ('CANONICAL_JSON','PUBLISHED_PDF')
WHERE rt.code IN ('MINUTE','REPORT','EXPENSE');

-- MINUTE permite inputs + LLM original (no requeridos)
INSERT INTO record_type_artifact_types (record_type_id, artifact_type_id, is_required_on_publish, max_count, is_active)
SELECT rt.id, at.id, 0, 1, 1
FROM record_types rt
JOIN artifact_types at ON at.code IN ('INPUT_TRANSCRIPT','INPUT_SUMMARY','LLM_JSON_ORIGINAL')
WHERE rt.code='MINUTE';

-- REPORT permite adjuntos
INSERT INTO record_type_artifact_types (record_type_id, artifact_type_id, is_required_on_publish, max_count, is_active)
SELECT rt.id, at.id, 0, 100, 1
FROM record_types rt
JOIN artifact_types at ON at.code='ATTACHMENT_IMAGE'
WHERE rt.code='REPORT';

-- ----------------------------------------------------------------------------
-- MIME + Extensiones + mapeos + defaults
-- ----------------------------------------------------------------------------
INSERT INTO mime_types (mime, description, is_active) VALUES
  ('application/pdf', 'PDF', 1),
  ('application/json', 'JSON estándar', 1),
  ('text/plain; charset=utf-8', 'Texto plano UTF-8', 1),
  ('image/png', 'Imagen PNG', 1),
  ('image/jpeg', 'Imagen JPEG', 1);

INSERT INTO file_extensions (ext, description, is_active) VALUES
  ('pdf', 'PDF', 1),
  ('json', 'JSON', 1),
  ('txt', 'Texto', 1),
  ('png', 'PNG', 1),
  ('jpg', 'JPEG', 1),
  ('jpeg', 'JPEG', 1);

INSERT INTO mime_type_extensions (mime_type_id, file_extension_id, is_default, is_active)
SELECT mt.id, fe.id, 1, 1
FROM mime_types mt
JOIN file_extensions fe ON
  (mt.mime='application/pdf' AND fe.ext='pdf') OR
  (mt.mime='application/json' AND fe.ext='json') OR
  (mt.mime='text/plain; charset=utf-8' AND fe.ext='txt') OR
  (mt.mime='image/png' AND fe.ext='png') OR
  (mt.mime='image/jpeg' AND fe.ext IN ('jpg','jpeg'));

-- Defaults MIME por artifact_type
INSERT INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, 1, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime='text/plain; charset=utf-8'
WHERE at.code IN ('INPUT_TRANSCRIPT','INPUT_SUMMARY');

INSERT INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, 1, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime='application/json'
WHERE at.code IN ('LLM_JSON_ORIGINAL','CANONICAL_JSON');

INSERT INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, 1, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime='application/pdf'
WHERE at.code IN ('PUBLISHED_PDF');

INSERT INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, CASE WHEN mt.mime='image/png' THEN 1 ELSE 0 END, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime IN ('image/png','image/jpeg')
WHERE at.code IN ('ATTACHMENT_IMAGE');
