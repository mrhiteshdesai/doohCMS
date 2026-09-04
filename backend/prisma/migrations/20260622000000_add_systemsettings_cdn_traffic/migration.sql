-- Align live schema with current Prisma model for system settings.
ALTER TABLE "SystemSettings"
ADD COLUMN IF NOT EXISTS "cdn" JSONB;

ALTER TABLE "SystemSettings"
ADD COLUMN IF NOT EXISTS "traffic" JSONB;
