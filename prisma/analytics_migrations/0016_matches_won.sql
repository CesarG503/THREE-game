-- Migration: 0016_matches_won
-- Phase 40: Add matchesWon column to PlayerFeatures for skill score computation (win rate).

ALTER TABLE analytics."PlayerFeatures"
  ADD COLUMN IF NOT EXISTS "matchesWon" INTEGER NOT NULL DEFAULT 0;
