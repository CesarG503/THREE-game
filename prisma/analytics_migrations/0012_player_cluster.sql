-- Migration: Add clusterId to PlayerFeatures in analytics schema
ALTER TABLE analytics."PlayerFeatures" ADD COLUMN IF NOT EXISTS "clusterId" TEXT;
