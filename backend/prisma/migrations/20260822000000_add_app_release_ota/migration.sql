-- CreateTable
CREATE TABLE "AppRelease" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "versionName" TEXT NOT NULL,
    "versionCode" INTEGER NOT NULL,
    "apkUrl" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "fileSize" BIGINT,
    "minSdk" INTEGER,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUpdateEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "releaseId" TEXT,
    "commandId" TEXT,
    "targetVersion" TEXT,
    "targetCode" INTEGER,
    "fromVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUpdateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppRelease_tenantId_idx" ON "AppRelease"("tenantId");

-- CreateIndex
CREATE INDEX "AppRelease_versionCode_idx" ON "AppRelease"("versionCode");

-- CreateIndex
CREATE INDEX "AppUpdateEvent_tenantId_idx" ON "AppUpdateEvent"("tenantId");

-- CreateIndex
CREATE INDEX "AppUpdateEvent_screenId_idx" ON "AppUpdateEvent"("screenId");

-- CreateIndex
CREATE INDEX "AppUpdateEvent_releaseId_idx" ON "AppUpdateEvent"("releaseId");

-- CreateIndex
CREATE INDEX "AppUpdateEvent_status_idx" ON "AppUpdateEvent"("status");

-- AddForeignKey
ALTER TABLE "AppRelease" ADD CONSTRAINT "AppRelease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUpdateEvent" ADD CONSTRAINT "AppUpdateEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUpdateEvent" ADD CONSTRAINT "AppUpdateEvent_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "AppRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
