import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

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

const app = express();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ 
    message: err.message || 'Internal Server Error',
  });
});

export default app;
