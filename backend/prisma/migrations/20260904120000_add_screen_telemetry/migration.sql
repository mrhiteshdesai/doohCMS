-- Screen telemetry columns used by native player heartbeats / fleet health
ALTER TABLE "Screen" ADD COLUMN IF NOT EXISTS "cpuTemp" DOUBLE PRECISION;
ALTER TABLE "Screen" ADD COLUMN IF NOT EXISTS "freeDiskSpace" BIGINT;
ALTER TABLE "Screen" ADD COLUMN IF NOT EXISTS "totalDiskSpace" BIGINT;
ALTER TABLE "Screen" ADD COLUMN IF NOT EXISTS "usedMemory" BIGINT;
ALTER TABLE "Screen" ADD COLUMN IF NOT EXISTS "totalMemory" BIGINT;
ALTER TABLE "Screen" ADD COLUMN IF NOT EXISTS "appVersion" TEXT;
ALTER TABLE "Screen" ADD COLUMN IF NOT EXISTS "lastTelemetryAt" TIMESTAMP(3);
