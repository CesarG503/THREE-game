-- Alter Table PlayerFeatures inside schema analytics to support schedule profiles
ALTER TABLE analytics."PlayerFeatures" ADD COLUMN "scheduleProfile" JSONB;
