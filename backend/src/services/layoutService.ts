import prisma from '../prisma';

export const createLayout = async (
  tenantId: string,
  name: string,
  description?: string
) => {
  return prisma.layout.create({
    data: {
      name,
      description,
      tenantId,
    },
  });
};

export const getLayouts = async (
  tenantId: string,
  filters: {
    search?: string;
  } = {},
  sort: {
    field: 'createdAt' | 'name';
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

  const layouts = await prisma.layout.findMany({
    where,
    orderBy,
    include: {
      zones: true, // Include actual zones for preview
      _count: {
        select: { zones: true },
      },
    },
  });

  return layouts;
};

export const getLayoutById = async (id: string, tenantId: string) => {
  return prisma.layout.findFirst({
    where: { id, tenantId },
    include: {
      zones: true
    }
  });
};

export const updateLayout = async (
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
  await prisma.layout.updateMany({
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
    const layout = await prisma.layout.findFirst({ where: { id, tenantId } });
    if (!layout) throw new Error("Layout not found");

    await prisma.$transaction(async (tx: any) => {
      // Delete old
      await tx.layoutZone.deleteMany({
        where: { layoutId: id }
      });

      // Create new
      const zones = (data.zones as any[]) || [];
      for (const zone of zones) {
        await tx.layoutZone.create({
          data: {
            layoutId: id,
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
    });
  }

  return getLayoutById(id, tenantId);
};

export const deleteLayout = async (id: string, tenantId: string) => {
  return prisma.layout.deleteMany({
    where: { id, tenantId },
  });
};

export const deleteLayoutsBulk = async (ids: string[], tenantId: string) => {
  return prisma.layout.deleteMany({
    where: {
      id: { in: ids },
      tenantId,
    },
  });
};
