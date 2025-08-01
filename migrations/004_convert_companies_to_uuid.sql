-- Migration: Convert companies table to use UUID instead of SERIAL ID
-- This improves security by making company IDs non-guessable

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create new UUID column for companies
ALTER TABLE companies ADD COLUMN uuid UUID DEFAULT uuid_generate_v4();

-- Update all existing companies to have UUIDs
UPDATE companies SET uuid = uuid_generate_v4() WHERE uuid IS NULL;

-- Make UUID not null and unique
ALTER TABLE companies ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE companies ADD CONSTRAINT companies_uuid_unique UNIQUE (uuid);

-- Add index on UUID for performance
CREATE INDEX idx_companies_uuid ON companies(uuid);

-- Note: We keep the old 'id' column for now to avoid breaking existing relationships
-- In production, you would:
-- 1. Update all foreign key references to use UUID
-- 2. Drop the old 'id' column
-- 3. Rename 'uuid' column to 'id'
-- For this demo, we'll use the UUID column alongside the existing ID