import prisma from '../prisma';

export const cleanupOldLogs = async () => {
  try {
    const retentionDays = 30; // Keep logs for 30 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = await prisma.screenLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    console.log(`[Cleanup] Deleted ${deleted.count} old screen logs created before ${cutoffDate.toISOString()}`);
  } catch (error) {
    console.error('[Cleanup] Failed to clean up old logs:', error);
  }
};

export const startCleanupJob = () => {
  // Calculate time until next midnight
  const now = new Date();
  const night = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1, // tomorrow
    0, 0, 0 // 00:00:00
  );
  const msToMidnight = night.getTime() - now.getTime();

  console.log(`[Scheduler] Log cleanup job scheduled in ${Math.round(msToMidnight / 1000 / 60)} minutes`);

  // Schedule first run
  setTimeout(() => {
    cleanupOldLogs();
    
    // Schedule subsequent runs every 24 hours
    setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);
  }, msToMidnight);
};
