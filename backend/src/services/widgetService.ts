import prisma from '../prisma';

export const getTenantWidgets = async (tenantId: string) => {
  const widgets = await prisma.widget.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' }
  });

  return widgets.map(widget => ({
    ...widget,
    config: JSON.parse(widget.config)
  }));
};

export const createWidget = async (tenantId: string, data: any) => {
  const { name, type, config } = data;
  const widget = await prisma.widget.create({
    data: {
      name,
      type,
      config: JSON.stringify(config),
      tenantId
    }
  });

  return {
    ...widget,
    config: JSON.parse(widget.config)
  };
};

export const getWidget = async (id: string, tenantId: string) => {
  const widget = await prisma.widget.findUnique({
    where: { id }
  });

  if (!widget || widget.tenantId !== tenantId) {
    throw new Error('Widget not found');
  }

  return {
    ...widget,
    config: JSON.parse(widget.config)
  };
};

export const updateWidget = async (id: string, tenantId: string, data: any) => {
  const { name, config } = data;
  
  // Verify ownership
  await getWidget(id, tenantId);

  const widget = await prisma.widget.update({
    where: { id },
    data: {
      name,
      config: config ? JSON.stringify(config) : undefined
    }
  });

  return {
    ...widget,
    config: JSON.parse(widget.config)
  };
};

export const deleteWidget = async (id: string, tenantId: string) => {
  // Verify ownership
  await getWidget(id, tenantId);

  return prisma.widget.delete({
    where: { id }
  });
};