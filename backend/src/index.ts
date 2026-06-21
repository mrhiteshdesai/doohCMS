import app from './app';
import prisma from './prisma';
import { appEnv } from './config/env';

import { startCleanupJob } from './jobs/logCleanup';
import { startStatusCheckJob } from './jobs/screenStatus';

async function main() {
  try {
    // Check DB connection (optional, prisma connects lazily usually)
    // await prisma.$connect();
    // console.log('Connected to Database');

    // Start background jobs
    startCleanupJob();
    startStatusCheckJob();

    const server = app.listen(appEnv.PORT, () => {
      console.log(`Server running on port ${appEnv.PORT} in ${appEnv.NODE_ENV} mode`);
    });
    
    // Increase timeout to 10 minutes for large uploads
    server.timeout = 600000;
    server.keepAliveTimeout = 600000;
    server.headersTimeout = 601000;

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
      });
      await prisma.$disconnect();
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
