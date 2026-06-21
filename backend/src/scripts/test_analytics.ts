import { getHourlyStats } from '../services/analyticsService';
import prisma from '../prisma';

async function testAnalytics() {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.log('No tenant found.');
      return;
    }

    console.log('Testing Analytics for Tenant:', tenant.id);

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7); // Last 7 days

    console.log(`Fetching stats from ${start.toISOString()} to ${end.toISOString()}`);

    const stats = await getHourlyStats(tenant.id, start, end);
    console.log('Hourly Stats Count:', stats.length);
    if (stats.length > 0) {
        console.log('First record:', stats[0]);
        console.log('Last record:', stats[stats.length - 1]);
    } else {
        console.log('No stats found. (This is expected if no ProofOfPlay data exists yet)');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAnalytics();
