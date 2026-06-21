import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import prisma from '../prisma';
import * as systemSettingsService from '../services/systemSettingsService';

interface StorageSettings {
  provider: string;
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
}

interface CdnSettings {
  enabled: boolean;
  baseUrl: string;
}

const normalizeSha256 = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : undefined;
};

const computeSha256FromReadable = async (stream: NodeJS.ReadableStream): Promise<string> => {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

const computeSha256FromFile = async (filePath: string): Promise<string> => {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

const computeSha256FromUrl = async (url: string, redirectsLeft: number = 3): Promise<string> => {
  return await new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === 'http:' ? http : https;

    const request = client.get(target, response => {
      const status = response.statusCode || 0;
      const location = response.headers.location;

      if (status in { 301: 1, 302: 1, 303: 1, 307: 1, 308: 1 } && location && redirectsLeft > 0) {
        response.resume();
        const nextUrl = new URL(location, target).toString();
        computeSha256FromUrl(nextUrl, redirectsLeft - 1).then(resolve).catch(reject);
        return;
      }

      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }

      computeSha256FromReadable(response).then(resolve).catch(reject);
    });

    request.on('error', reject);
  });
};

const computeSha256FromS3Object = async (client: S3Client, bucket: string, key: string): Promise<string> => {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = response.Body;
  if (!body || typeof (body as any).on !== 'function') {
    throw new Error('S3 object body not readable');
  }
  return await computeSha256FromReadable(body as NodeJS.ReadableStream);
};

const deriveStorageKeyFromUrl = (url: string, cdnBaseUrl?: string): string | null => {
  const normalizedCdn = cdnBaseUrl?.replace(/\/$/, '');
  if (normalizedCdn && url.startsWith(normalizedCdn)) {
    const rest = url.substring(normalizedCdn.length).replace(/^\/+/, '');
    return rest || null;
  }

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/^\/+/, '');
    const idx = pathname.indexOf('uploads/');
    if (idx >= 0) return pathname.substring(idx);
    return pathname || null;
  } catch {
    const trimmed = url.replace(/^\/+/, '');
    const idx = trimmed.indexOf('uploads/');
    if (idx >= 0) return trimmed.substring(idx);
    return trimmed || null;
  }
};

const resolveLocalPathFromMediaUrl = (mediaUrl: string): string | null => {
  if (!mediaUrl.startsWith('/uploads/')) return null;
  const backendRoot = path.resolve(__dirname, '..', '..');
  return path.join(backendRoot, mediaUrl.replace(/^\//, ''));
};

const buildS3Client = (settings: StorageSettings): S3Client => {
  return new S3Client({
    region: settings.region,
    credentials: {
      accessKeyId: settings.accessKeyId || '',
      secretAccessKey: settings.secretAccessKey || '',
    },
    endpoint: settings.endpoint || undefined,
    forcePathStyle: !!settings.endpoint,
  });
};

const main = async () => {
  const systemSettings = await systemSettingsService.getSystemSettings();
  const storage = systemSettings?.storage as unknown as StorageSettings | undefined;
  const cdn = systemSettings?.cdn as unknown as CdnSettings | undefined;

  const isS3 = storage?.provider === 's3' && !!storage.bucket;
  const s3Client = isS3 ? buildS3Client(storage!) : null;

  const batchSize = 50;
  let processed = 0;

  while (true) {
    const rows = await prisma.mediaFile.findMany({
      where: { sha256: null },
      select: { id: true, url: true },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      processed += 1;
      const url = row.url;
      try {
        let sha256: string | undefined;

        const localPath = resolveLocalPathFromMediaUrl(url);
        if (localPath && fs.existsSync(localPath)) {
          sha256 = await computeSha256FromFile(localPath);
        } else if (isS3 && s3Client && storage?.bucket) {
          const key = deriveStorageKeyFromUrl(url, cdn?.baseUrl);
          if (key) {
            sha256 = await computeSha256FromS3Object(s3Client, storage.bucket, key);
          }
        }

        if (!sha256 && (url.startsWith('http://') || url.startsWith('https://'))) {
          sha256 = await computeSha256FromUrl(url);
        }

        sha256 = normalizeSha256(sha256);
        if (!sha256) {
          throw new Error('Unable to compute sha256');
        }

        await prisma.mediaFile.update({
          where: { id: row.id },
          data: { sha256 } as any,
        });
      } catch (e: any) {
        // Skip and continue; this is a backfill job.
        // Consider re-running after storage/CDN config is corrected.
        // Do not throw to keep the batch moving.
        // eslint-disable-next-line no-console
        console.warn(`[sha256-backfill] Failed for media ${row.id}: ${e?.message || e}`);
      }
    }

    // eslint-disable-next-line no-console
    console.log(`[sha256-backfill] Processed ${processed} rows...`);
  }

  // eslint-disable-next-line no-console
  console.log('[sha256-backfill] Done');
};

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[sha256-backfill] Fatal:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

