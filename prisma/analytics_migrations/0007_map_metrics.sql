-- Alter Table MapFeatures inside schema analytics to support map profiles
ALTER TABLE analytics."MapFeatures" ADD COLUMN "medianPlaytime" DOUBLE PRECISION;
ALTER TABLE analytics."MapFeatures" ADD COLUMN "completionRate" DOUBLE PRECISION;
ALTER TABLE analytics."MapFeatures" ADD COLUMN "retentionCurve" JSONB;
