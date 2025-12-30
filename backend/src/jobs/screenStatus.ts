import prisma from '../prisma';
import { createLog } from '../services/screenService';

export const checkOfflineScreens = async () => {
  try {
    // Increased threshold to 10 minutes to be safer against network jitters
    const offlineThreshold = 10 * 60 * 1000; 
    const cutoffDate = new Date(Date.now() - offlineThreshold);

    // Find screens that are ONLINE but haven't been seen recently
    const offlineScreens = await prisma.screen.findMany({
      where: {
        status: 'ONLINE',
        isDeleted: false,
        lastSeenAt: {
          lt: cutoffDate
        }
      }
    });

    if (offlineScreens.length > 0) {
      console.log(`[Status] Found ${offlineScreens.length} screens that have gone OFFLINE (cutoff: ${cutoffDate.toISOString()})`);

      for (const screen of offlineScreens) {
        console.log(`[Status] Marking screen ${screen.id} OFFLINE (lastSeenAt: ${screen.lastSeenAt})`);
        await prisma.screen.update({
          where: { id: screen.id },
          data: { status: 'OFFLINE' }
        });

        await createLog(screen.id, 'WARN', `Screen went OFFLINE (heartbeat timeout). Last seen: ${screen.lastSeenAt}`);
      }
    }
  } catch (error) {
    console.error('[Status] Failed to check screen status:', error);
  }
};

export const startStatusCheckJob = () => {
  console.log('[Scheduler] Screen status check job scheduled (running every 1 minute)');
  
  // Run immediately to catch up
  checkOfflineScreens();
  
  // Schedule every 1 minute
  setInterval(checkOfflineScreens, 60 * 1000);
};
