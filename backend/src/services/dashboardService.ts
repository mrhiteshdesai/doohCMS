import prisma from '../prisma';

export const getDashboardStats = async (tenantId: string) => {
  try {
    // 1. Basic Counts
    const [
      totalScreens,
      onlineScreens,
      deletedScreens,
      totalPlaylists,
      totalMedia,
      storageStats
    ] = await Promise.all([
      prisma.screen.count({ where: { tenantId, isDeleted: false } }),
      prisma.screen.count({ where: { tenantId, status: 'ONLINE', isDeleted: false } }),
      prisma.screen.count({ where: { tenantId, isDeleted: true } }),
      prisma.playlist.count({ where: { tenantId } }),
      prisma.mediaFile.count({ where: { tenantId } }),
      prisma.mediaFile.aggregate({ where: { tenantId }, _sum: { size: true } })
    ]);

    // 2. Recent Activity
    const recentActivity = await prisma.auditLog.findMany({
      where: { tenantId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });

    // 3. Media Distribution
    // Use simple grouping without count inside, or use raw query if Prisma type is tricky
    // The previous code had a type error on _count inside groupBy
    
    const mediaTypes = await prisma.mediaFile.groupBy({
      by: ['mimeType'],
      where: { tenantId },
      _count: {
        _all: true
      }
    });

    // 4. Top Media (Optimized with Continuous Aggregates)
    let topMediaRaw: any[] = [];
    try {
        // Try to query the materialized view first
        const result: any[] = await prisma.$queryRaw`
            SELECT "mediaId", sum(play_count) as total_plays
            FROM pop_hourly_stats
            WHERE "tenantId" = ${tenantId}
            GROUP BY "mediaId"
            ORDER BY total_plays DESC
            LIMIT 5
        `;
        
        topMediaRaw = result.map(r => ({
            mediaId: r.mediaId,
            _count: { _all: Number(r.total_plays) }
        }));
    } catch (e) {
        // Fallback to standard Prisma query if view is missing or fails
        // console.warn('Analytics view query failed, falling back to raw table:', e);
        try {
            const result = await prisma.proofOfPlay.groupBy({
                by: ['mediaId'],
                where: { tenantId },
                _count: {
                    _all: true
                }
            });
            topMediaRaw = result as any[];
            topMediaRaw.sort((a, b) => b._count._all - a._count._all);
            topMediaRaw = topMediaRaw.slice(0, 5);
        } catch (err) {
            console.error('Error fetching top media:', err);
        }
    }

    // Fetch names for top media
    const mediaIds = topMediaRaw.map(m => m.mediaId);
    const mediaDetails = await prisma.mediaFile.findMany({
      where: {
        id: { in: mediaIds }
      },
      select: { id: true, name: true }
    });

    const topMedia = topMediaRaw.map(item => {
      const media = mediaDetails.find((m: any) => m.id === item.mediaId);
      return {
        name: media?.name || 'Unknown',
        plays: item._count._all
      };
    });

    return {
      screens: {
        total: totalScreens,
        online: onlineScreens,
        offline: totalScreens - onlineScreens,
        deleted: deletedScreens
      },
      content: {
        playlists: totalPlaylists,
        mediaCount: totalMedia,
        storageUsed: storageStats._sum.size || 0
      },
      activity: recentActivity,
      mediaDistribution: mediaTypes.map((m: any) => ({
        type: m.mimeType,
        count: m._count._all
      })),
      topMedia
    };

  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    throw error;
  }
};
