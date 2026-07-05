-- Create Table DataQuarantine in schema analytics
CREATE TABLE analytics."DataQuarantine" (
    "id" TEXT NOT NULL,
    "originalId" TEXT,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "quarantinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataQuarantine_pkey" PRIMARY KEY ("id")
);
