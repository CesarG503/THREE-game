-- Create FatiguedMap table in analytics schema
CREATE TABLE IF NOT EXISTS analytics."FatiguedMap" (
    "userId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "fatiguedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FatiguedMap_pkey" PRIMARY KEY ("userId", "mapId"),
    CONSTRAINT "FatiguedMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES analytics."User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FatiguedMap_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES analytics."GameMap"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Index to quickly query and clean up expired blacklists
CREATE INDEX IF NOT EXISTS "FatiguedMap_expiresAt_idx" ON analytics."FatiguedMap"("expiresAt");
