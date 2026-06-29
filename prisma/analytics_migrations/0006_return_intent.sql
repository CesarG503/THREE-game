-- Migration: Add returnIntent column to PlayerFeatures
ALTER TABLE analytics."PlayerFeatures" ADD COLUMN "returnIntent" DOUBLE PRECISION;
