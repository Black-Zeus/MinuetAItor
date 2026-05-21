INSERT IGNORE INTO mime_types (mime, description, is_active) VALUES
  ('image/gif',  'Imagen GIF', 1),
  ('image/webp', 'Imagen WebP', 1);

INSERT IGNORE INTO file_extensions (ext, description, is_active) VALUES
  ('gif',  'GIF', 1),
  ('webp', 'WebP', 1);

INSERT IGNORE INTO mime_type_extensions (mime_type_id, file_extension_id, is_default, is_active)
SELECT mt.id, fe.id, 1, 1
FROM mime_types mt
JOIN file_extensions fe ON mt.mime = 'image/gif' AND fe.ext = 'gif';

INSERT IGNORE INTO mime_type_extensions (mime_type_id, file_extension_id, is_default, is_active)
SELECT mt.id, fe.id, 1, 1
FROM mime_types mt
JOIN file_extensions fe ON mt.mime = 'image/webp' AND fe.ext = 'webp';

INSERT IGNORE INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, 0, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime = 'image/gif'
WHERE at.code = 'ATTACHMENT_IMAGE';

INSERT IGNORE INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, 0, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime = 'image/webp'
WHERE at.code = 'ATTACHMENT_IMAGE';
