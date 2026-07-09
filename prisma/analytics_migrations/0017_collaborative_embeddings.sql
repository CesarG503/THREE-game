-- Migration: 0017_collaborative_embeddings
-- Phase 42: Add collaborativeEmbedding column to PlayerFeatures and MapFeatures for latent vectors.

ALTER TABLE analytics."PlayerFeatures"
  ADD COLUMN IF NOT EXISTS "collaborativeEmbedding" JSONB;

ALTER TABLE analytics."MapFeatures"
  ADD COLUMN IF NOT EXISTS "collaborativeEmbedding" JSONB;
