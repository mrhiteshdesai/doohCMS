import { Prisma } from '@prisma/client';
import prisma from '../prisma';

export const createPlaylist = async (
  tenantId: string,
  name: string,
  description?: string,
  layoutId?: string
) => {
  // If layoutId is provided, fetch the layout
  let layoutData: any = {};
  let zonesToCreate: any[] = [];

  if (layoutId) {
    const layout = await prisma.layout.findUnique({
      where: { id: layoutId },
      include: { zones: true }
    });

    if (layout) {
      layoutData = {
        resolution: layout.resolution,
        canvasWidth: layout.canvasWidth,
        canvasHeight: layout.canvasHeight,
        orientation: layout.orientation,
      };
      zonesToCreate = layout.zones;
    }
  }

  return prisma.$transaction(async (tx: any) => {
    const playlist = await tx.playlist.create({
      data: {
        name,
        description,
        tenantId,
        ...layoutData,
      },
    });

    if (zonesToCreate.length > 0) {
      for (const zone of zonesToCreate) {
        await tx.playlistZone.create({
          data: {
            playlistId: playlist.id,
            name: zone.name,
            x: zone.x,
            y: zone.y,
            width: zone.width,
            height: zone.height,
            zIndex: zone.zIndex,
            rotation: zone.rotation,
          }
        });
      }
    }
    
    return playlist;
  });
};

export const getPlaylists = async (
  tenantId: string,
  filters: {
    search?: string;
  } = {},
  sort: {
    field: 'createdAt' | 'name' | 'screenCount';
    direction: 'asc' | 'desc';
  } = { field: 'createdAt', direction: 'desc' }
) => {
  const where: any = {
    tenantId,
  };

  if (filters.search) {
    where.name = { contains: filters.search };
  }

  let orderBy: any = {};
  if (sort.field === 'name') {
    orderBy = { name: sort.direction };
  } else if (sort.field === 'createdAt') {
    orderBy = { createdAt: sort.direction };
  }

  const playlists = await prisma.playlist.findMany({
    where,
    orderBy: sort.field !== 'screenCount' ? orderBy : undefined,
    include: {
      _count: {
        select: { 
          zones: true
        },
      },
      activeOnScreens: {
        select: { id: true }
      },
      activeOnGroups: {
        select: {
          members: {
            select: { screenId: true }
          }
        }
      },
      zones: {
        include: {
          items: {
            take: 1,
            orderBy: { order: 'asc' },
            include: {
              media: true,
              widget: true
            }
          }
        }
      }
    },
  });

  return playlists.map(p => {
    const directScreenIds = p.activeOnScreens.map(s => s.id);
    const groupScreenIds = p.activeOnGroups.flatMap(g => g.members.map(m => m.screenId));
    
    const uniqueScreenIds = new Set([...directScreenIds, ...groupScreenIds]);
    
    const { activeOnScreens, activeOnGroups, ...rest } = p;
    
    return {
      ...rest,
      screenCount: uniqueScreenIds.size
    };
  });
};

export const getPlaylistById = async (id: string, tenantId: string) => {
  return prisma.playlist.findFirst({
    where: { id, tenantId },
    include: {
      zones: {
        include: {
          items: {
            include: {
              media: true,
              widget: true
            },
            orderBy: {
              order: 'asc'
            }
          }
        }
      }
    }
  });
};

export const updatePlaylist = async (
  id: string,
  tenantId: string,
  data: {
    name?: string;
    description?: string;
    resolution?: string;
    canvasWidth?: number;
    canvasHeight?: number;
    orientation?: string;
    zones?: any[];
  }
) => {
  // 1. Update basic fields
  await prisma.playlist.updateMany({
    where: { id, tenantId },
    data: {
      name: data.name,
      description: data.description,
      resolution: data.resolution,
      canvasWidth: data.canvasWidth,
      canvasHeight: data.canvasHeight,
      orientation: data.orientation,
    },
  });

  // 2. If zones provided, replace them (Full Save)
  if (data.zones) {
    // Delete existing zones (cascades to items)
    // Note: We need to verify ownership before delete, but updateMany above ensures existence + ownership check implicitly if we checked count,
    // but here we just proceed.
    // Ideally we should do this in a transaction.
    
    // First verify ownership to be safe
    const playlist = await prisma.playlist.findFirst({ where: { id, tenantId } });
    if (!playlist) throw new Error("Playlist not found");

    await prisma.$transaction(async (tx: any) => {
      // Delete old
      await tx.playlistZone.deleteMany({
        where: { playlistId: id }
      });

      // Create new
      const zones = (data.zones as any[]) || [];
      for (const zone of zones) {
        const createdZone = await tx.playlistZone.create({
          data: {
            playlistId: id,
            name: zone.name,
            x: zone.x,
            y: zone.y,
            width: zone.width,
            height: zone.height,
            zIndex: zone.zIndex,
            rotation: zone.rotation,
          }
        });

        if (zone.items && zone.items.length > 0) {
          await tx.playlistZoneItem.createMany({
            data: zone.items.map((item: any, index: number) => {
              const isWidget = !!(item.widgetId || item.type === 'WIDGET');
              const isAdSlot =
                !!(item.vastUrl || item.type === 'AD_SLOT') && !isWidget;
              return {
                zoneId: createdZone.id,
                mediaId: item.mediaId || null,
                widgetId: item.widgetId || null,
                type: isAdSlot ? 'AD_SLOT' : isWidget ? 'WIDGET' : 'MEDIA',
                order: index,
                duration: item.duration ?? 10,
                vastUrl: isAdSlot ? String(item.vastUrl || '').trim() || null : null,
                vastTimeoutMs:
                  isAdSlot && item.vastTimeoutMs != null
                    ? Number(item.vastTimeoutMs) || 3000
                    : 3000,
              };
            })
          });
        }
      }
    });
  }

  return getPlaylistById(id, tenantId);
};

export const deletePlaylist = async (id: string, tenantId: string) => {
  return prisma.playlist.deleteMany({
    where: { id, tenantId },
  });
};

export const deletePlaylistsBulk = async (ids: string[], tenantId: string) => {
  return prisma.playlist.deleteMany({
    where: {
      id: { in: ids },
      tenantId,
    },
  });
};
