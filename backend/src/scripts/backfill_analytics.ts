import prisma from '../prisma';

async function backfill() {
    console.log('Backfilling analytics view (pop_hourly_stats)...');
    try {
        // Backfill from 1 year ago to now
        // This might take a while if there is a lot of data.
        await prisma.$executeRawUnsafe(`
            CALL refresh_continuous_aggregate('pop_hourly_stats', 
                (now() - INTERVAL '1 year')::timestamp, 
                now()::timestamp);
        `);
        console.log('Backfill complete.');
    } catch (e) {
        console.error('Error backfilling:', e);
    } finally {
        await prisma.$disconnect();
    }
}
backfill();
