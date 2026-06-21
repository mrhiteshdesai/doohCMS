const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../Smartags V2/backend/src/services/systemSettingsService.ts');
console.log('Writing to:', filePath);

const content = `import prisma from '../prisma';

export const getSystemSettings = async () => {
  const settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    return {
      storage: {
        provider: 'local',
      },
      cdn: {
        enabled: false,
        baseUrl: ''
      },
      traffic: {
        downloadJitter: 0
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
        cdn: data.cdn,
        traffic: data.traffic
      }
    });
  } else {
    return await prisma.systemSettings.create({
      data: {
        storage: data.storage,
        cdn: data.cdn,
        traffic: data.traffic
      }
    });
  }
};
`;

try {
    fs.writeFileSync(filePath, content);
    console.log('File written.');
} catch (e) {
    console.error('Error:', e);
}
