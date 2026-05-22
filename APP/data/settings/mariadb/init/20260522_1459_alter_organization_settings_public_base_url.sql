ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS public_base_url VARCHAR(500) NULL AFTER website;
