-- Alter Table MapFeatures inside schema analytics to support map virality and sticky factor
ALTER TABLE analytics."MapFeatures" ADD COLUMN "stickyFactor" DOUBLE PRECISION;
ALTER TABLE analytics."MapFeatures" ADD COLUMN "viralityFactor" DOUBLE PRECISION;
