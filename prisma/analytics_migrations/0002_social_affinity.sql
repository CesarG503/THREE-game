-- Create SocialAffinity table in analytics schema
CREATE TABLE IF NOT EXISTS analytics."SocialAffinity" (
    id TEXT PRIMARY KEY,
    "userId1" TEXT NOT NULL,
    "userId2" TEXT NOT NULL,
    affinity DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialAffinity_userId1_fkey" FOREIGN KEY ("userId1") REFERENCES analytics."User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SocialAffinity_userId2_fkey" FOREIGN KEY ("userId2") REFERENCES analytics."User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint to prevent duplicate links
CREATE UNIQUE INDEX IF NOT EXISTS "SocialAffinity_userId1_userId2_key" ON analytics."SocialAffinity"("userId1", "userId2");

-- Indexes to quickly retrieve top affinities per user
CREATE INDEX IF NOT EXISTS "SocialAffinity_userId1_affinity_idx" ON analytics."SocialAffinity"("userId1", affinity DESC);
CREATE INDEX IF NOT EXISTS "SocialAffinity_userId2_affinity_idx" ON analytics."SocialAffinity"("userId2", affinity DESC);
