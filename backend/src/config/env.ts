import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CORS_ORIGINS: z.string().optional(),
  TRUST_PROXY: z
    .union([z.literal('true'), z.literal('false'), z.string(), z.undefined()])
    .transform((value) => {
      if (value === undefined) return false;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }),
  ALLOW_PUBLIC_REGISTRATION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  HEALTHCHECK_DB_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  PLAYER_REGISTER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  PLAYER_REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  PLAYER_STATUS_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  PLAYER_STATUS_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  HEARTBEAT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  HEARTBEAT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  COMMAND_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
  COMMAND_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

const env = parsed.data;

if (env.NODE_ENV === 'production' && !env.CORS_ORIGINS) {
  throw new Error('CORS_ORIGINS must be set in production');
}

export const appEnv = {
  ...env,
  corsOrigins: env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : LOCAL_ORIGINS,
};

export type AppEnv = typeof appEnv;
