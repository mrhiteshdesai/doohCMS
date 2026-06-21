import prisma from '../prisma';

async function setupAnalytics() {
  console.log('Setting up Analytics (Continuous Aggregates)...');

  try {
    // 1. Create Materialized View for Hourly Proof of Play Stats
    // Note: We use raw SQL because Prisma doesn't support this yet.
    // We group by tenantId, mediaId, screenId, playlistId to allow filtering.
    // We aggregate count and duration.
    
    // NOTE: TimescaleDB requires "WITH (timescaledb.continuous)"
    
    console.log('Creating Materialized View: pop_hourly_stats...');
    const createViewQuery = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS pop_hourly_stats
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 hour', "startedAt") as bucket,
        "tenantId",
        "mediaId",
        "screenId",
        "playlistId",
        count(*) as play_count,
        sum(duration) as total_duration
      FROM "ProofOfPlay"
      GROUP BY bucket, "tenantId", "mediaId", "screenId", "playlistId"
      WITH NO DATA;
    `;
    
    await prisma.$executeRawUnsafe(createViewQuery);
    console.log('Created pop_hourly_stats view.');

    // 2. Add Refresh Policy
    // Refresh the last 30 days of data every hour.
    // We use a try-catch because "add_continuous_aggregate_policy" throws if a policy already exists.
    
    console.log('Adding refresh policy...');
    try {
        await prisma.$executeRawUnsafe(`
        SELECT add_continuous_aggregate_policy('pop_hourly_stats',
            start_offset => INTERVAL '30 days',
            end_offset => INTERVAL '1 hour',
            schedule_interval => INTERVAL '1 hour');
        `);
        console.log('Added refresh policy for pop_hourly_stats.');
    } catch (e: any) {
        if (e.message.includes('already exists') || e.message.includes('already associated')) {
             console.log('Refresh policy already exists.');
        } else {
             console.warn('Could not add refresh policy (might already exist or other error):', e.message);
        }
    }
    
    // 3. Enable Real-time Aggregation (Default is enabled, but good to ensure)
    // This allows queries to include data not yet materialized in the view.
    try {
        await prisma.$executeRawUnsafe(`
            ALTER MATERIALIZED VIEW pop_hourly_stats set (timescaledb.materialized_only = false);
        `);
        console.log('Real-time aggregation enabled.');
    } catch (e) {
        // Ignore error if it's already set or not supported in this version
    }

    console.log('Analytics setup complete.');
  } catch (error) {
    console.error('Error setting up analytics:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupAnalytics();
