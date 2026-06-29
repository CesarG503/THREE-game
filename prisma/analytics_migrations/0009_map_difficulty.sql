-- Alter Table MapFeatures inside schema analytics to support map difficulty and pace profiling
ALTER TABLE analytics."MapFeatures" ADD COLUMN "difficultyScore" DOUBLE PRECISION;
ALTER TABLE analytics."MapFeatures" ADD COLUMN "difficultyLabel" TEXT;
ALTER TABLE analytics."MapFeatures" ADD COLUMN "paceScore" DOUBLE PRECISION;
ALTER TABLE analytics."MapFeatures" ADD COLUMN "paceLabel" TEXT;
ALTER TABLE analytics."MapFeatures" ADD COLUMN "earlyAbandonRate" DOUBLE PRECISION;
