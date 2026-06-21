import { Request, Response } from 'express';
import * as analyticsService from '../services/analyticsService';

export const getProofOfPlayStats = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { startDate, endDate, mediaId, screenId, playlistId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
    }

    const stats = await analyticsService.getHourlyStats(tenantId, start, end, {
      mediaId: mediaId as string,
      screenId: screenId as string,
      playlistId: playlistId as string
    });

    res.json(stats);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};
