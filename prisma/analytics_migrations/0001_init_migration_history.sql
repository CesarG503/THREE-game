-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create User table in analytics schema
CREATE TABLE IF NOT EXISTS analytics."User" (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create GameMap table in analytics schema
CREATE TABLE IF NOT EXISTS analytics."GameMap" (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    "ownerId" TEXT,
    "isPublished" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create RawEvent table partitioned by timestamp
CREATE TABLE IF NOT EXISTS analytics."RawEvent" (
    id TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL,
    PRIMARY KEY (id, timestamp),
    FOREIGN KEY ("userId") REFERENCES analytics."User" (id) ON DELETE SET NULL
) PARTITION BY RANGE (timestamp);


-- Redefine create_raw_event_partition with full body
CREATE OR REPLACE FUNCTION analytics.create_raw_event_partition(partition_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    start_date := DATE_TRUNC('month', partition_date);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'RawEvent_' || TO_CHAR(start_date, 'YYYY_MM');

    EXECUTE FORMAT(
        'CREATE TABLE IF NOT EXISTS analytics.%I PARTITION OF analytics."RawEvent" '
        'FOR VALUES FROM (%L) TO (%L);',
        partition_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;

-- Pre-create partitions for current month, next month, and the month after
SELECT analytics.create_raw_event_partition(CURRENT_DATE);
SELECT analytics.create_raw_event_partition((CURRENT_DATE + INTERVAL '1 month')::DATE);
SELECT analytics.create_raw_event_partition((CURRENT_DATE + INTERVAL '2 months')::DATE);

-- Create indexes on parent table
CREATE INDEX IF NOT EXISTS idx_raw_event_type ON analytics."RawEvent" ("eventType");
CREATE INDEX IF NOT EXISTS idx_raw_event_user ON analytics."RawEvent" ("userId");
CREATE INDEX IF NOT EXISTS idx_raw_event_timestamp ON analytics."RawEvent" (timestamp);

-- Replication trigger function for User
CREATE OR REPLACE FUNCTION public.replicate_user_to_analytics()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO analytics."User" (id, email, username, "displayName", "createdAt", "updatedAt")
        VALUES (NEW.id, NEW.email, NEW.username, NEW."displayName", NEW."createdAt", NEW."updatedAt")
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            username = EXCLUDED.username,
            "displayName" = EXCLUDED."displayName",
            "updatedAt" = EXCLUDED."updatedAt";
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE analytics."User"
        SET email = NEW.email,
            username = NEW.username,
            "displayName" = NEW."displayName",
            "updatedAt" = NEW."updatedAt"
        WHERE id = NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM analytics."User" WHERE id = OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create User replication trigger
DROP TRIGGER IF EXISTS trigger_replicate_user ON public."User";
CREATE TRIGGER trigger_replicate_user
AFTER INSERT OR UPDATE OR DELETE ON public."User"
FOR EACH ROW EXECUTE FUNCTION public.replicate_user_to_analytics();

-- Replication trigger function for GameMap
CREATE OR REPLACE FUNCTION public.replicate_gamemap_to_analytics()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO analytics."GameMap" (id, slug, name, "ownerId", "isPublished", "createdAt", "updatedAt")
        VALUES (NEW.id, NEW.slug, NEW.name, NEW."ownerId", NEW."isPublished", NEW."createdAt", NEW."updatedAt")
        ON CONFLICT (id) DO UPDATE SET
            slug = EXCLUDED.slug,
            name = EXCLUDED.name,
            "ownerId" = EXCLUDED."ownerId",
            "isPublished" = EXCLUDED."isPublished",
            "updatedAt" = EXCLUDED."updatedAt";
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE analytics."GameMap"
        SET slug = NEW.slug,
            name = NEW.name,
            "ownerId" = NEW."ownerId",
            "isPublished" = NEW."isPublished",
            "updatedAt" = NEW."updatedAt"
        WHERE id = NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM analytics."GameMap" WHERE id = OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create GameMap replication trigger
DROP TRIGGER IF EXISTS trigger_replicate_gamemap ON public."GameMap";
CREATE TRIGGER trigger_replicate_gamemap
AFTER INSERT OR UPDATE OR DELETE ON public."GameMap"
FOR EACH ROW EXECUTE FUNCTION public.replicate_gamemap_to_analytics();

-- Create PlayerFeatures table
CREATE TABLE IF NOT EXISTS analytics."PlayerFeatures" (
    "userId" TEXT PRIMARY KEY,
    "lastActive" TIMESTAMP WITH TIME ZONE NOT NULL,
    "totalPlayTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    FOREIGN KEY ("userId") REFERENCES analytics."User" (id) ON DELETE CASCADE
);

-- Create MapFeatures table
CREATE TABLE IF NOT EXISTS analytics."MapFeatures" (
    "mapId" TEXT PRIMARY KEY,
    "totalJoins" INTEGER NOT NULL DEFAULT 0,
    "totalLeaves" INTEGER NOT NULL DEFAULT 0,
    "bounceCount" INTEGER NOT NULL DEFAULT 0,
    "averageDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    FOREIGN KEY ("mapId") REFERENCES analytics."GameMap" (id) ON DELETE CASCADE
);

-- Replication / Aggregation trigger function for RawEvent
CREATE OR REPLACE FUNCTION analytics.update_features_on_raw_event()
RETURNS TRIGGER AS $$
DECLARE
    event_type_val TEXT;
    user_id_val TEXT;
    map_id_val TEXT;
    duration_val DOUBLE PRECISION;
    lang_val TEXT;
BEGIN
    event_type_val := NEW."eventType";
    user_id_val := NEW."userId";

    -- Update PlayerFeatures if userId is not null
    IF user_id_val IS NOT NULL THEN
        -- Try to get language from payload if SessionStart
        IF event_type_val = 'SessionStart' AND (NEW.payload ? 'language') THEN
            lang_val := NEW.payload->>'language';
        END IF;

        -- Initialize or update PlayerFeatures
        INSERT INTO analytics."PlayerFeatures" (
            "userId", 
            "lastActive", 
            "totalPlayTime", 
            "matchesPlayed", 
            "preferredLanguage"
        )
        VALUES (
            user_id_val, 
            NEW.timestamp, 
            0, 
            CASE WHEN event_type_val = 'MatchJoin' THEN 1 ELSE 0 END, 
            COALESCE(lang_val, 'en')
        )
        ON CONFLICT ("userId") DO UPDATE SET
            "lastActive" = NEW.timestamp,
            "preferredLanguage" = CASE WHEN lang_val IS NOT NULL THEN lang_val ELSE analytics."PlayerFeatures"."preferredLanguage" END,
            "matchesPlayed" = analytics."PlayerFeatures"."matchesPlayed" + CASE WHEN event_type_val = 'MatchJoin' THEN 1 ELSE 0 END;
        
        -- If it's a MatchLeave, we update totalPlayTime on PlayerFeatures
        IF event_type_val = 'MatchLeave' AND (NEW.payload ? 'durationSeconds') THEN
            duration_val := (NEW.payload->>'durationSeconds')::DOUBLE PRECISION;
            UPDATE analytics."PlayerFeatures"
            SET "totalPlayTime" = "totalPlayTime" + duration_val
            WHERE "userId" = user_id_val;
        END IF;
    END IF;

    -- Update MapFeatures if it's MatchJoin or MatchLeave
    IF event_type_val = 'MatchJoin' OR event_type_val = 'MatchLeave' THEN
        IF NEW.payload ? 'mapId' THEN
            map_id_val := NEW.payload->>'mapId';
            
            IF map_id_val IS NOT NULL THEN
                -- Ensure MapFeatures row exists
                INSERT INTO analytics."MapFeatures" ("mapId", "totalJoins", "totalLeaves", "bounceCount", "averageDuration", "bounceRate")
                VALUES (map_id_val, 0, 0, 0, 0, 0)
                ON CONFLICT ("mapId") DO NOTHING;

                IF event_type_val = 'MatchJoin' THEN
                    UPDATE analytics."MapFeatures"
                    SET "totalJoins" = "totalJoins" + 1
                    WHERE "mapId" = map_id_val;
                ELSIF event_type_val = 'MatchLeave' THEN
                    duration_val := COALESCE((NEW.payload->>'durationSeconds')::DOUBLE PRECISION, 0.0);
                    
                    UPDATE analytics."MapFeatures"
                    SET 
                        "totalLeaves" = "totalLeaves" + 1,
                        "bounceCount" = "bounceCount" + CASE WHEN duration_val < 10 THEN 1 ELSE 0 END,
                        "averageDuration" = (("averageDuration" * "totalLeaves") + duration_val) / ("totalLeaves" + 1),
                        "bounceRate" = ("bounceCount" + CASE WHEN duration_val < 10 THEN 1 ELSE 0 END)::DOUBLE PRECISION / ("totalLeaves" + 1)
                    WHERE "mapId" = map_id_val;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on RawEvent
DROP TRIGGER IF EXISTS trigger_update_features ON analytics."RawEvent";
CREATE TRIGGER trigger_update_features
AFTER INSERT ON analytics."RawEvent"
FOR EACH ROW EXECUTE FUNCTION analytics.update_features_on_raw_event();
