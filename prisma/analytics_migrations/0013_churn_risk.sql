-- Migration: Add churnScore and atRisk columns to PlayerFeatures
ALTER TABLE analytics."PlayerFeatures"
ADD COLUMN IF NOT EXISTS "churnScore" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "atRisk" BOOLEAN NOT NULL DEFAULT FALSE;
