ALTER TABLE participants
  ADD COLUMN avatar_object_id CHAR(36) NULL AFTER is_active,
  ADD KEY idx_participants_avatar_object_id (avatar_object_id),
  ADD CONSTRAINT fk_participants_avatar_object FOREIGN KEY (avatar_object_id) REFERENCES objects(id);
