import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import crypto from 'crypto';
import prisma from './prisma';
import { appEnv } from './config/env';
import { appMetrics } from './observability/metrics';

// Fix BigInt serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import authRoutes from './routes/authRoutes';
import screenRoutes from './routes/screenRoutes';
import playerRoutes from './routes/playerRoutes';
import mediaRoutes from './routes/mediaRoutes';
import screenGroupRoutes from './routes/screenGroupRoutes';
import playlistRoutes from './routes/playlistRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import widgetRoutes from './routes/widgetRoutes';
import layoutRoutes from './routes/layoutRoutes';
import userRoutes from './routes/userRoutes';
import tenantRoutes from './routes/tenantRoutes';
import reportRoutes from './routes/reportRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import systemSettingsRoutes from './routes/systemSettingsRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import appReleaseRoutes from './routes/appReleaseRoutes';

const app = express();

app.set('trust proxy', appEnv.TRUST_PROXY);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (appEnv.corsOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route = req.route?.path || req.originalUrl.split('?')[0] || req.path;
    appMetrics.recordRequest(req.method, route, res.statusCode, durationMs);
  });

  next();
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get(['/health/live', '/api/health/live'], (req, res) => {
  res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
});
app.get(['/health/ready', '/api/health/ready'], async (req, res) => {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database readiness timeout')), appEnv.HEALTHCHECK_DB_TIMEOUT_MS)
      ),
    ]);
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      message: error.message,
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/screens', screenRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/library', mediaRoutes);
app.use('/api/screen-groups', screenGroupRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/widgets', widgetRoutes);
app.use('/api/layouts', layoutRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/system-settings', systemSettingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/app-releases', appReleaseRoutes);

// Static files serving with robust path resolution
const uploadDir = path.join(__dirname, '../uploads');
console.log('Serving static files from:', uploadDir);

app.use('/uploads', (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(uploadDir));

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ 
    message: err.message || 'Internal Server Error',
  });
});

export default app;
