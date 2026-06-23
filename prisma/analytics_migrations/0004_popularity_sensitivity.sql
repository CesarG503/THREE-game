-- Migration: 0004_popularity_sensitivity
-- Description: Añade campo para medir el sesgo hacia mapas populares del usuario.

ALTER TABLE analytics."PlayerFeatures" 
ADD COLUMN IF NOT EXISTS "popularitySensitivity" DOUBLE PRECISION;
