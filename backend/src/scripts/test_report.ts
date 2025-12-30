
import prisma from '../prisma';
import { generateUptimeReport } from '../services/reportService';

async function main() {
  console.log('--- REPORT TEST START ---');

  // 1. Create a dummy tenant and screen
  const tenant = await prisma.tenant.create({
    data: { name: 'Test Tenant' }
  });
  
  const screen = await prisma.screen.create({
    data: {
      name: 'Report Test Screen',
      tenantId: tenant.id,
      status: 'ONLINE'
    }
  });

  // Manually set createdAt to 2 days ago
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  await prisma.screen.update({
    where: { id: screen.id },
    data: { createdAt: twoDaysAgo }
  });

  console.log(`Created screen ${screen.id} at ${twoDaysAgo.toISOString()}`);

  // 2. Create Logs
  // Scenario: 
  // - Born 48h ago.
  // - Offline at 40h ago.
  // - Online at 30h ago. (10h downtime)
  // - Offline at 10h ago.
  // - Online at 5h ago. (5h downtime)
  // Total expected downtime: 15h.
  // Total expected uptime: 33h.

  const log1Time = new Date(Date.now() - 40 * 60 * 60 * 1000);
  const log2Time = new Date(Date.now() - 30 * 60 * 60 * 1000);
  const log3Time = new Date(Date.now() - 10 * 60 * 60 * 1000);
  const log4Time = new Date(Date.now() - 5 * 60 * 60 * 1000);

  await prisma.screenLog.createMany({
    data: [
      { screenId: screen.id, level: 'WARN', message: 'Screen went OFFLINE', createdAt: log1Time },
      { screenId: screen.id, level: 'INFO', message: 'Screen is back ONLINE', createdAt: log2Time },
      { screenId: screen.id, level: 'WARN', message: 'Screen went OFFLINE', createdAt: log3Time },
      { screenId: screen.id, level: 'INFO', message: 'Screen is back ONLINE', createdAt: log4Time },
    ]
  });

  console.log('Logs created.');

  // 3. Generate Report
  const report = await generateUptimeReport(tenant.id, undefined, undefined, screen.id);
  
  console.log('--- REPORT RESULT ---');
  console.log(JSON.stringify(report, null, 2));

  // 4. Cleanup
  await prisma.screenLog.deleteMany({ where: { screenId: screen.id } });
  await prisma.screen.delete({ where: { id: screen.id } });
  await prisma.tenant.delete({ where: { id: tenant.id } });
  
  console.log('--- CLEANUP DONE ---');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
