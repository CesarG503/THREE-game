-- Migration: 0018_experiment_ab
-- Phase 48: Create Experiment table for A/B testing configurations in schema analytics

CREATE TABLE analytics."Experiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "splitA" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Experiment_name_key" ON analytics."Experiment"("name");
