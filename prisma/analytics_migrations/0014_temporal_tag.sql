-- Migration: Add temporalTag column to PlayerFeatures
ALTER TABLE analytics."PlayerFeatures"
ADD COLUMN IF NOT EXISTS "temporalTag" TEXT;
