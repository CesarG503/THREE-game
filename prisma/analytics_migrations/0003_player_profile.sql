-- Migration: 0003_player_profile
-- Description: Agrega los campos para almacenar el ratio de entropía de mapas y la etiqueta del perfil inferida.

ALTER TABLE analytics."PlayerFeatures" 
ADD COLUMN IF NOT EXISTS "explorerRatio" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "playerProfile" TEXT;
