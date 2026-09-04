import { Request, Response } from 'express';
import prisma from '../prisma';

export const getProofOfPlay = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const { startDate, endDate, screenId, mediaId } = req.query;

    const where: any = {
      tenantId,
    };

    if (startDate && endDate) {
      where.startedAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (screenId) {
      where.screenId = screenId as string;
    }

    if (mediaId) {
      where.mediaId = mediaId as string;
    }

    const logs = await prisma.proofOfPlay.findMany({
      where,
      include: {
        screen: {
          select: {
            name: true,
          },
        },
        media: {
          select: {
            name: true,
          },
        },
        playlist: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 1000, // Limit to prevent overload
    });

    const report = logs.map(log => ({
      id: log.id,
      mediaName: log.media.name,
      playlistName: log.playlist?.name || 'N/A',
      screenName: log.screen.name,
      screenId: log.screenId,
      startedAt: log.startedAt,
      endedAt: new Date(log.startedAt.getTime() + log.duration * 1000),
      duration: log.duration,
      status: 'Success', // Assuming entry in this table means success
    }));

    res.json(report);
  } catch (error: any) {
    console.error('PoP Report Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getAdImpressions = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const { startDate, endDate, screenId } = req.query;
    const { listAdImpressions } = await import('../services/adImpressionService');
    const logs = await listAdImpressions(tenantId, {
      screenId: screenId ? String(screenId) : undefined,
      from: startDate ? new Date(String(startDate)) : undefined,
      to: endDate ? new Date(String(endDate)) : undefined,
      limit: 1000,
    });
    res.json(
      logs.map((log) => ({
        id: log.id,
        screenName: log.screen?.name || log.screenId,
        screenId: log.screenId,
        playlistId: log.playlistId,
        playlistItemId: log.playlistItemId,
        vastAdId: log.vastAdId,
        creativeId: log.creativeId,
        mediaFileUrl: log.mediaFileUrl,
        fallbackMedia: log.fallbackMedia?.name || null,
        filled: log.filled,
        completed: log.completed,
        durationSec: log.durationSec,
        error: log.error,
        startedAt: log.startedAt,
      }))
    );
  } catch (error: any) {
    console.error('Ad Impression Report Error:', error);
    res.status(500).json({ message: error.message });
  }
};

import { generateUptimeReport } from '../services/reportService';

export const getUptimeReport = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const { startDate, endDate, screenId } = req.query;

    const report = await generateUptimeReport(
        tenantId, 
        startDate as string, 
        endDate as string, 
        screenId as string
    );

    res.json(report);

  } catch (error: any) {
    console.error('Uptime Report Error:', error);
    res.status(500).json({ message: error.message });
  }
};
