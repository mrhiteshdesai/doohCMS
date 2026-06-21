import prisma from '../prisma';

export const getHourlyStats = async (tenantId: string, startDate: Date, endDate: Date, filters: { mediaId?: string; screenId?: string; playlistId?: string } = {}) => {
  const { mediaId, screenId, playlistId } = filters;
  
  const params: any[] = [tenantId, startDate, endDate];
  let sql = `
    SELECT bucket, sum(play_count) as play_count, sum(total_duration) as total_duration
    FROM pop_hourly_stats
    WHERE "tenantId" = $1
    AND bucket >= $2
    AND bucket <= $3
  `;
  
  let paramIndex = 4;
  if (mediaId) {
    sql += ` AND "mediaId" = $${paramIndex}`;
    params.push(mediaId);
    paramIndex++;
  }
  if (screenId) {
    sql += ` AND "screenId" = $${paramIndex}`;
    params.push(screenId);
    paramIndex++;
  }
  if (playlistId) {
    sql += ` AND "playlistId" = $${paramIndex}`;
    params.push(playlistId);
    paramIndex++;
  }
  
  sql += ` GROUP BY bucket ORDER BY bucket ASC`;
  
  try {
      const result: any[] = await prisma.$queryRawUnsafe(sql, ...params);
      
      // Format result
      // Note: play_count and total_duration might be BigInt, so we convert to Number
      return result.map(row => ({
        timestamp: row.bucket,
        playCount: Number(row.play_count || 0),
        totalDuration: Number(row.total_duration || 0)
      }));
  } catch (error) {
      console.error('Error querying analytics:', error);
      throw new Error('Failed to fetch analytics data');
  }
};
