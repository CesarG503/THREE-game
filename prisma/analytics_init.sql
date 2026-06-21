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

-- Function to dynamically create a partition for RawEvent
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
