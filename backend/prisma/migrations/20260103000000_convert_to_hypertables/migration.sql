-- AlterTable
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_pkey",
ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id", "createdAt");

-- AlterTable
ALTER TABLE "ProofOfPlay" DROP CONSTRAINT "ProofOfPlay_pkey",
ADD CONSTRAINT "ProofOfPlay_pkey" PRIMARY KEY ("id", "startedAt");

-- AlterTable
ALTER TABLE "ScreenHeartbeat" DROP CONSTRAINT "ScreenHeartbeat_pkey",
ADD CONSTRAINT "ScreenHeartbeat_pkey" PRIMARY KEY ("id", "timestamp");

-- AlterTable
ALTER TABLE "ScreenLog" DROP CONSTRAINT "ScreenLog_pkey",
ADD CONSTRAINT "ScreenLog_pkey" PRIMARY KEY ("id", "createdAt");

-- Convert to Hypertables
SELECT create_hypertable('"AuditLog"', 'createdAt', if_not_exists => TRUE);
SELECT create_hypertable('"ProofOfPlay"', 'startedAt', if_not_exists => TRUE);
SELECT create_hypertable('"ScreenHeartbeat"', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('"ScreenLog"', 'createdAt', if_not_exists => TRUE);
