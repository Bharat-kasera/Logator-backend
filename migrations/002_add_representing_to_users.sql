-- Modify the establishments table
ALTER TABLE establishments
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  ADD COLUMN logo TEXT;
