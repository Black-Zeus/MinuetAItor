/* 20_schema_alter_indexes.sql */

-- ----------------------------------------------------------------------------
-- 1) Agregar columnas ID para MIME/EXT en objects + FKs + índices
-- ----------------------------------------------------------------------------
ALTER TABLE objects
  ADD COLUMN mime_type_id SMALLINT UNSIGNED NULL AFTER object_key,
  ADD COLUMN file_extension_id SMALLINT UNSIGNED NULL AFTER mime_type_id;

ALTER TABLE objects
  ADD CONSTRAINT fk_obj_mime_type FOREIGN KEY (mime_type_id) REFERENCES mime_types(id),
  ADD CONSTRAINT fk_obj_file_ext FOREIGN KEY (file_extension_id) REFERENCES file_extensions(id);

CREATE INDEX idx_objects_mime_type ON objects(mime_type_id);
CREATE INDEX idx_objects_file_ext ON objects(file_extension_id);

-- ----------------------------------------------------------------------------
-- 2) Corrección unicidad record_artifacts:
--    - eliminar índice conflictivo si existiera (si no existe, este DROP fallará)
-- ----------------------------------------------------------------------------
-- Si tu motor no permite DROP sin IF EXISTS, ejecútalo manualmente una vez validado:
-- ALTER TABLE record_artifacts DROP INDEX uq_ra_record_draft_type;

-- ----------------------------------------------------------------------------
-- 3) Unicidad condicional para drafts (columna generada + unique)
-- ----------------------------------------------------------------------------
ALTER TABLE record_artifacts
  ADD COLUMN draft_artifact_type_id SMALLINT UNSIGNED
    GENERATED ALWAYS AS (
      CASE WHEN is_draft = 1 THEN artifact_type_id ELSE NULL END
    ) STORED;

ALTER TABLE record_artifacts
  ADD UNIQUE KEY uq_ra_record_draft_type2 (record_id, draft_artifact_type_id);

-- ----------------------------------------------------------------------------
-- 4) Unicidad por versión (1 artefacto por tipo por versión)
-- ----------------------------------------------------------------------------
ALTER TABLE record_artifacts
  ADD UNIQUE KEY uq_ra_version_type (record_version_id, artifact_type_id);
