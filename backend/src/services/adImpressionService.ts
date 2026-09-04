import prisma from '../prisma';

export const submitAdImpression = async (
  screenId: string,
  data: {
    playlistId?: string;
    playlistItemId?: string;
    vastAdId?: string;
    creativeId?: string;
    mediaFileUrl?: string;
    fallbackMediaId?: string;
    filled?: boolean;
    completed?: boolean;
    durationSec?: number;
    error?: string;
    startedAt?: string | Date;
  }
) => {
  const screen = await prisma.screen.findUnique({ where: { id: screenId } });
  if (!screen || screen.isDeleted) throw new Error('Screen not found');
  if (!screen.tenantId) throw new Error('Screen has no tenant');

  const startedAt = data.startedAt ? new Date(data.startedAt) : new Date();

  return prisma.adImpression.create({
    data: {
      tenantId: screen.tenantId,
      screenId,
      playlistId: data.playlistId || null,
      playlistItemId: data.playlistItemId || null,
      vastAdId: data.vastAdId || null,
      creativeId: data.creativeId || null,
      mediaFileUrl: data.mediaFileUrl || null,
      fallbackMediaId: data.fallbackMediaId || null,
      filled: !!data.filled,
      completed: !!data.completed,
      durationSec: Number(data.durationSec) || 0,
      error: data.error || null,
      startedAt,
    },
  });
};

export const listAdImpressions = async (
  tenantId: string,
  opts?: { screenId?: string; from?: Date; to?: Date; limit?: number }
) => {
  return prisma.adImpression.findMany({
    where: {
      tenantId,
      ...(opts?.screenId ? { screenId: opts.screenId } : {}),
      ...(opts?.from || opts?.to
        ? {
            startedAt: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: opts?.limit || 200,
    include: {
      screen: { select: { id: true, name: true } },
      fallbackMedia: { select: { id: true, name: true, url: true } },
    },
  });
};
