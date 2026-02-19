/* 00_preamble.sql */
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

/* 30_triggers.sql */

DELIMITER $$

-- ----------------------------------------------------------------------------
-- A) Enforcement draft: record_artifacts.is_draft exige record_drafts vigente
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_ra_require_record_draft_ins
BEFORE INSERT ON record_artifacts
FOR EACH ROW
BEGIN
  IF NEW.is_draft = 1 THEN
    IF NEW.record_version_id IS NOT NULL THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Artefacto draft no puede tener record_version_id.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM record_drafts d
      WHERE d.record_id = NEW.record_id
        AND d.deleted_at IS NULL
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No existe draft vigente (record_drafts) para este record.';
    END IF;
  ELSE
    IF NEW.record_version_id IS NULL THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Artefacto publicado requiere record_version_id.';
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_ra_require_record_draft_upd
BEFORE UPDATE ON record_artifacts
FOR EACH ROW
BEGIN
  IF NEW.is_draft = 1 THEN
    IF NEW.record_version_id IS NOT NULL THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Artefacto draft no puede tener record_version_id.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM record_drafts d
      WHERE d.record_id = NEW.record_id
        AND d.deleted_at IS NULL
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No existe draft vigente (record_drafts) para este record.';
    END IF;
  ELSE
    IF NEW.record_version_id IS NULL THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Artefacto publicado requiere record_version_id.';
    END IF;
  END IF;
END$$

-- ----------------------------------------------------------------------------
-- B) objects: sincronización MIME/EXT (IDs fuente de verdad)
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_objects_sync_mime_ext_ins
BEFORE INSERT ON objects
FOR EACH ROW
BEGIN
  -- --------------------------------------------------------------------------
  -- Sincroniza IDs <-> textos para MIME y extensión.
  -- Nota: en triggers NO se permite `SELECT ... INTO NEW.col`. Se debe usar SET.
  -- --------------------------------------------------------------------------

  -- MIME
  IF NEW.mime_type_id IS NOT NULL THEN
    SET NEW.content_type = (
      SELECT mt.mime
        FROM mime_types mt
       WHERE mt.id = NEW.mime_type_id
         AND mt.is_active = 1
         AND mt.deleted_at IS NULL
       LIMIT 1
    );
  ELSE
    SET NEW.mime_type_id = (
      SELECT mt.id
        FROM mime_types mt
       WHERE mt.mime = NEW.content_type
         AND mt.is_active = 1
         AND mt.deleted_at IS NULL
       LIMIT 1
    );
  END IF;

  -- EXT
  IF NEW.file_extension_id IS NOT NULL THEN
    SET NEW.file_ext = (
      SELECT fe.ext
        FROM file_extensions fe
       WHERE fe.id = NEW.file_extension_id
         AND fe.is_active = 1
         AND fe.deleted_at IS NULL
       LIMIT 1
    );
  ELSE
    SET NEW.file_extension_id = (
      SELECT fe.id
        FROM file_extensions fe
       WHERE fe.ext = NEW.file_ext
         AND fe.is_active = 1
         AND fe.deleted_at IS NULL
       LIMIT 1
    );
  END IF;

  -- Validación final: ambos IDs deben quedar resueltos
  IF NEW.mime_type_id IS NULL OR NEW.file_extension_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'objects requiere mime_type_id y file_extension_id válidos (directo o resoluble por texto).';
  END IF;
END$$


CREATE TRIGGER trg_objects_sync_mime_ext_upd
BEFORE UPDATE ON objects
FOR EACH ROW
BEGIN
  -- --------------------------------------------------------------------------
  -- Sincroniza IDs <-> textos para MIME y extensión en UPDATE.
  -- Usa comparaciones NULL-safe (<=>) para detectar cambios reales.
  -- --------------------------------------------------------------------------

  -- si cambian IDs, sincronizar textos
  IF NOT (NEW.mime_type_id <=> OLD.mime_type_id) THEN
    SET NEW.content_type = (
      SELECT mt.mime
        FROM mime_types mt
       WHERE mt.id = NEW.mime_type_id
         AND mt.is_active = 1
         AND mt.deleted_at IS NULL
       LIMIT 1
    );
  END IF;

  IF NOT (NEW.file_extension_id <=> OLD.file_extension_id) THEN
    SET NEW.file_ext = (
      SELECT fe.ext
        FROM file_extensions fe
       WHERE fe.id = NEW.file_extension_id
         AND fe.is_active = 1
         AND fe.deleted_at IS NULL
       LIMIT 1
    );
  END IF;

  -- si cambian textos, resolver IDs (tolerante)
  IF NOT (NEW.content_type <=> OLD.content_type) THEN
    SET NEW.mime_type_id = (
      SELECT mt.id
        FROM mime_types mt
       WHERE mt.mime = NEW.content_type
         AND mt.is_active = 1
         AND mt.deleted_at IS NULL
       LIMIT 1
    );
  END IF;

  IF NOT (NEW.file_ext <=> OLD.file_ext) THEN
    SET NEW.file_extension_id = (
      SELECT fe.id
        FROM file_extensions fe
       WHERE fe.ext = NEW.file_ext
         AND fe.is_active = 1
         AND fe.deleted_at IS NULL
       LIMIT 1
    );
  END IF;

  IF NEW.mime_type_id IS NULL OR NEW.file_extension_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'objects requiere mime_type_id y file_extension_id válidos.';
  END IF;
END$$


DELIMITER ;
