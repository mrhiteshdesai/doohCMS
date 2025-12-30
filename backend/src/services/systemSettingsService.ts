import prisma from '../prisma';

export const getSystemSettings = async () => {
  const settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    return {
      storage: {
        provider: 'local',
      }
    };
  }
  return settings;
};

export const updateSystemSettings = async (data: any) => {
  const current = await prisma.systemSettings.findFirst();
  if (current) {
    return await prisma.systemSettings.update({
      where: { id: current.id },
      data: {
        storage: data.storage,
      }
    });
  } else {
    return await prisma.systemSettings.create({
      data: {
        storage: data.storage,
      }
    });
  }
};
