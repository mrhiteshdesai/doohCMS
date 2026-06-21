import rateLimit from 'express-rate-limit';
import { appEnv } from '../config/env';
import { appMetrics } from '../observability/metrics';

const defaultMessage = 'Too many requests, please try again later.';

const createLimiter = (windowMs: number, max: number, keySelector?: (req: any) => string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keySelector,
    handler: (req, res) => {
      appMetrics.recordRateLimitHit();
      res.status(429).json({ message: defaultMessage });
    }
  });

export const authLimiter = createLimiter(
  appEnv.AUTH_RATE_LIMIT_WINDOW_MS,
  appEnv.AUTH_RATE_LIMIT_MAX
);

export const playerRegisterLimiter = createLimiter(
  appEnv.PLAYER_REGISTER_RATE_LIMIT_WINDOW_MS,
  appEnv.PLAYER_REGISTER_RATE_LIMIT_MAX
);

export const playerStatusLimiter = createLimiter(
  appEnv.PLAYER_STATUS_RATE_LIMIT_WINDOW_MS,
  appEnv.PLAYER_STATUS_RATE_LIMIT_MAX
);

export const heartbeatLimiter = createLimiter(
  appEnv.HEARTBEAT_RATE_LIMIT_WINDOW_MS,
  appEnv.HEARTBEAT_RATE_LIMIT_MAX,
  (req) => req.user?.id || req.ip
);

export const commandLimiter = createLimiter(
  appEnv.COMMAND_RATE_LIMIT_WINDOW_MS,
  appEnv.COMMAND_RATE_LIMIT_MAX,
  (req) => req.user?.id || req.ip
);
