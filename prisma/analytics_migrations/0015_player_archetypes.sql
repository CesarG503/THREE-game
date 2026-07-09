-- Migration: Add archetypeWeights column to PlayerFeatures
ALTER TABLE analytics."PlayerFeatures"
ADD COLUMN IF NOT EXISTS "archetypeWeights" JSONB;
