import prisma from '../prisma';

export const generateUptimeReport = async (tenantId: string, startDate?: string, endDate?: string, screenId?: string) => {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Fix: If endDate is provided (e.g. "2025-12-28"), it defaults to 00:00:00.
    // We want to include the full day, so we set it to end of day, but cap it at "now" to avoid future uptime.
    let end = new Date();
    if (endDate) {
        const endOfDay = new Date(endDate);
        // Set to end of day in UTC (since YYYY-MM-DD parses as UTC midnight)
        // Actually, let's just use local end of day concept if possible, but safely just add almost 24h
        endOfDay.setUTCHours(23, 59, 59, 999);
        
        const now = new Date();
        end = endOfDay > now ? now : endOfDay;
    } else {
        end = new Date();
    }

    // Fetch screens
    const screenWhere: any = { tenantId };
    if (screenId) screenWhere.id = screenId;
    
    const screens = await prisma.screen.findMany({
      where: screenWhere,
      select: { id: true, name: true, status: true, lastSeenAt: true, createdAt: true }
    });

    const report = await Promise.all(screens.map(async (screen: any) => {
      // Determine effective start date (cannot report uptime before screen existed)
      const effectiveStart = screen.createdAt > start ? screen.createdAt : start;
      
      // Get logs for status changes within the effective window
      const logs = await prisma.screenLog.findMany({
        where: {
          screenId: screen.id,
          createdAt: {
            gte: effectiveStart,
            lte: end
          },
          OR: [
            { message: { contains: 'Screen went OFFLINE' } },
            { message: { contains: 'Screen is back ONLINE' } },
            { message: { contains: 'Screen paired successfully' } }
          ]
        },
        orderBy: { createdAt: 'asc' }
      });

      let totalDurationMs = end.getTime() - effectiveStart.getTime();
      // Ensure totalDuration is not negative
      if (totalDurationMs < 0) totalDurationMs = 0;

      let offlineDurationMs = 0;
      let downtimeIncidents: { timestamp: string, duration: string }[] = [];
      let offlineStart: Date | null = null;
      let isInitiallyOffline = false;

      // 1. Determine Initial State at effectiveStart
      // Check prior log to see if we started in an OFFLINE state
      const lastLogBefore = await prisma.screenLog.findFirst({
        where: {
          screenId: screen.id,
          createdAt: { lt: effectiveStart },
          OR: [
            { message: { contains: 'Screen went OFFLINE' } },
            { message: { contains: 'Screen is back ONLINE' } },
            { message: { contains: 'Screen paired successfully' } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      if (lastLogBefore) {
          // Trust history
          if (lastLogBefore.message.includes('Screen went OFFLINE')) {
            isInitiallyOffline = true;
          }
      } else {
          // No prior logs. 
          if (logs.length > 0) {
              // Infer from first log in window.
              // If the first thing that happens is "Back ONLINE" or "Paired", we must have started OFFLINE.
              if (logs[0].message.includes('Screen is back ONLINE') || logs[0].message.includes('Screen paired successfully')) {
                  isInitiallyOffline = true;
              }
          } else {
              // No logs at all (neither before nor in window). Trust current status.
              // Treat UNPAIRED as OFFLINE for reporting purposes
              if (screen.status === 'OFFLINE' || screen.status === 'UNPAIRED') {
                  isInitiallyOffline = true;
              }
          }
      }
      
      // Special Case: If the effective start IS the creation time, 
      // the screen is born UNPAIRED (Offline) until paired.
      // So it starts offline regardless of current status (which might be ONLINE if paired later).
      if (effectiveStart.getTime() === screen.createdAt.getTime()) {
          isInitiallyOffline = true;
      }

      if (isInitiallyOffline) {
          offlineStart = effectiveStart;
      }

      // 2. Process Logs
      logs.forEach((log: any) => {
        if (log.message.includes('Screen went OFFLINE')) {
          if (!offlineStart) {
            offlineStart = log.createdAt;
          }
        } else if (log.message.includes('Screen is back ONLINE') || log.message.includes('Screen paired successfully')) {
          if (offlineStart) {
            const duration = log.createdAt.getTime() - offlineStart.getTime();
            offlineDurationMs += duration;
            
            downtimeIncidents.push({
              timestamp: offlineStart.toISOString(),
              duration: `${Math.round(duration / 1000 / 60)}m`
            });

            offlineStart = null;
          }
        }
      });

      // 3. Handle Open Interval (Currently Offline)
      if (offlineStart) {
        const duration = end.getTime() - offlineStart.getTime();
        offlineDurationMs += duration;
        downtimeIncidents.push({
            timestamp: offlineStart.toISOString(),
            duration: `${Math.round(duration / 1000 / 60)}m (ongoing)`
        });
      }

      // Edge case: If no logs, and effectiveStart == createdAt, and current status is OFFLINE?
      // This implies it was never online? Or went offline immediately?
      // If we have no logs, we assume 100% uptime, which is optimistic.
      // But for a new screen that failed to connect, this might be wrong.
      // However, the user's issue is specifically about "720h" for a screen that is 2 days old.
      // Fixing the totalDurationMs based on effectiveStart will fix the denominator.
      
      const onlineDurationMs = totalDurationMs - offlineDurationMs;
      const uptimePercentage = totalDurationMs > 0 ? (onlineDurationMs / totalDurationMs) * 100 : 0;

      return {
        screenId: screen.id,
        screenName: screen.name,
        onlineDuration: `${Math.floor(onlineDurationMs / 1000 / 60 / 60)}h ${Math.floor((onlineDurationMs / 1000 / 60) % 60)}m`,
        offlineDuration: `${Math.floor(offlineDurationMs / 1000 / 60 / 60)}h ${Math.floor((offlineDurationMs / 1000 / 60) % 60)}m`,
        uptimePercentage: Number(uptimePercentage.toFixed(2)),
        downtimeIncidents: downtimeIncidents.reverse()
      };
    }));

    return report;
};
