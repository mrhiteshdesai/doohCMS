-- AlterTable
ALTER TABLE "PlaylistZoneItem" ADD COLUMN IF NOT EXISTS "vastUrl" TEXT;
ALTER TABLE "PlaylistZoneItem" ADD COLUMN IF NOT EXISTS "vastTimeoutMs" INTEGER NOT NULL DEFAULT 3000;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdImpression" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "playlistId" TEXT,
    "playlistItemId" TEXT,
    "vastAdId" TEXT,
    "creativeId" TEXT,
    "mediaFileUrl" TEXT,
    "fallbackMediaId" TEXT,
    "filled" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdImpression_pkey" PRIMARY KEY ("id","startedAt")
);

CREATE INDEX IF NOT EXISTS "AdImpression_tenantId_idx" ON "AdImpression"("tenantId");
CREATE INDEX IF NOT EXISTS "AdImpression_screenId_idx" ON "AdImpression"("screenId");
CREATE INDEX IF NOT EXISTS "AdImpression_startedAt_idx" ON "AdImpression"("startedAt");

ALTER TABLE "AdImpression" DROP CONSTRAINT IF EXISTS "AdImpression_tenantId_fkey";
ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdImpression" DROP CONSTRAINT IF EXISTS "AdImpression_screenId_fkey";
ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdImpression" DROP CONSTRAINT IF EXISTS "AdImpression_fallbackMediaId_fkey";
ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_fallbackMediaId_fkey" FOREIGN KEY ("fallbackMediaId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
