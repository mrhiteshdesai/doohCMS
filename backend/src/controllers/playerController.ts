import { Request, Response } from 'express';
import prisma from '../prisma';
import * as screenService from '../services/screenService';
import * as systemSettingsService from '../services/systemSettingsService';
import fs from 'fs';
import path from 'path';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

interface StorageSettings {
    provider: string;
    bucket?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
}

export const getSystemBranding = async (req: Request, res: Response) => {
  try {
    // For now, fetch the first tenant's branding as the system default
    // In a real multi-tenant system, this might come from a specific "System Tenant" or env vars
    const tenant = await prisma.tenant.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { name: true, config: true }
    });

    if (!tenant) {
      return res.json({
        name: 'CMS Player',
        logoUrl: null,
        primaryColor: '#2563eb' // Default blue
      });
    }

    const config = tenant.config as any || {};
    res.json({
      name: tenant.name,
      logoUrl: config.logoUrl || null,
      primaryColor: config.primaryColor || '#2563eb',
      player: config.player || {}
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const generatePairingCode = async (req: Request, res: Response) => {
  try {
    const result = await screenService.registerPlayerDevice();
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const checkPairingStatus = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const result = await screenService.checkPairingStatus(code);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const heartbeat = async (req: Request, res: Response) => {
  try {
    const screenId = (req as any).user.id;
    // Pass request body (telemetry) to service
    const result = await screenService.processHeartbeat(screenId, req.body);
    res.status(200).json(result);
  } catch (error: any) {
    if (error.code === 'P2025' || error.message === 'Screen is deleted' || error.message === 'Screen not found') {
        return res.status(401).json({ message: 'Screen not found or deleted' });
    }
    res.status(500).json({ message: error.message });
  }
};

export const submitProofOfPlay = async (req: Request, res: Response) => {
  try {
    const screenId = (req as any).user.id;
    const tenantId = (req as any).user.tenantId; // Note: Middleware might need to populate this for screens too
    
    // For screens, the token payload has { id: screen.id, role: 'SCREEN' }
    // We need to fetch the screen to get the tenantId if it's not in token.
    // However, let's assume we fetch screen to verify tenant.
    
    const screen = await prisma.screen.findUnique({
      where: { id: screenId },
      select: { tenantId: true }
    });

    if (!screen || !screen.tenantId) {
      return res.status(403).json({ message: 'Screen not associated with a tenant' });
    }

    const logs = req.body.logs; // Array of { mediaId, playlistId, startedAt, duration }
    
    if (!Array.isArray(logs)) {
      return res.status(400).json({ message: 'Invalid logs format' });
    }

    // Filter out invalid logs (orphaned media or playlists) to prevent foreign key violations
    const uniqueMediaIds = [...new Set(logs.map((l: any) => l.mediaId).filter(Boolean))] as string[];
    const uniquePlaylistIds = [...new Set(logs.map((l: any) => l.playlistId).filter(Boolean))] as string[];

    const validMedia = await prisma.mediaFile.findMany({
      where: { id: { in: uniqueMediaIds } },
      select: { id: true }
    });
    const validMediaIds = new Set(validMedia.map(m => m.id));

    const validPlaylists = await prisma.playlist.findMany({
      where: { id: { in: uniquePlaylistIds } },
      select: { id: true }
    });
    const validPlaylistIds = new Set(validPlaylists.map(p => p.id));

    // Batch insert
    // We map logs to Prisma createMany input
    const entries = logs
      .filter((log: any) => {
        // Ensure media exists
        if (!validMediaIds.has(log.mediaId)) {
            console.warn(`[PoP] Skipping log for missing media: ${log.mediaId}`);
            return false;
        }
        // Ensure playlist exists if provided
        if (log.playlistId && !validPlaylistIds.has(log.playlistId)) {
            console.warn(`[PoP] Skipping log for missing playlist: ${log.playlistId}`);
            return false; // Or should we just nullify the playlistId? strict for now
        }
        // Ensure valid numbers
        if (isNaN(parseFloat(log.duration))) return false;
        
        return true;
      })
      .map((log: any) => ({
        screenId,
        tenantId: screen.tenantId!,
        mediaId: log.mediaId,
        playlistId: log.playlistId || null,
        startedAt: new Date(log.startedAt),
        duration: parseFloat(log.duration)
      }));

    if (entries.length > 0) {
        await prisma.proofOfPlay.createMany({
            data: entries
        });
    }

    // Log the activity
    await prisma.screenLog.create({
      data: {
        screenId,
        level: 'INFO',
        message: `Received ${logs.length} proof of play logs, saved ${entries.length}`
      }
    });

    res.status(200).json({ message: 'Logs saved', count: entries.length, received: logs.length });
  } catch (error: any) {
    console.error('PoP Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const uploadSnapshot = async (req: Request, res: Response) => {
  try {
    const screenId = (req as any).user.id;
    console.log(`[Snapshot] Upload request from screen ${screenId}`);
    
    if (!req.file) {
      console.warn(`[Snapshot] No file in request from screen ${screenId}`);
      return res.status(400).json({ message: 'No snapshot file uploaded' });
    }

    // Get System Settings to check storage provider
    const systemSettings = await systemSettingsService.getSystemSettings();
    const settings = systemSettings?.storage as unknown as StorageSettings | undefined;
    const isS3 = settings?.provider === 's3';
    let imageUrl = '';

    if (isS3 && settings?.bucket) {
        // Upload to S3
        const s3Client = new S3Client({
            region: settings.region,
            credentials: {
                accessKeyId: settings.accessKeyId || '',
                secretAccessKey: settings.secretAccessKey || '',
            },
            endpoint: settings.endpoint || undefined,
            forcePathStyle: !!settings.endpoint,
        });

        const fileStream = fs.createReadStream(req.file.path);
        
        // Calculate relative path from the actual file location
        const uploadDir = path.join(__dirname, '../../uploads');
        const relativePath = path.relative(uploadDir, req.file.destination).split(path.sep).join('/');
        
        const key = `snapshots/${relativePath}/${req.file.filename}`;

        try {
            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: settings.bucket,
                    Key: key,
                    Body: fileStream,
                    ContentType: req.file.mimetype,
                },
            });

            await upload.done();
            
            // Construct S3 URL
            if (settings.endpoint) {
                 imageUrl = `${settings.endpoint}/${settings.bucket}/${key}`;
            } else {
                 imageUrl = `https://${settings.bucket}.s3.${settings.region}.amazonaws.com/${key}`;
            }

            // Remove local file
            fs.unlinkSync(req.file.path);
        } catch (err) {
            console.error('S3 Upload Error:', err);
            throw new Error('Failed to upload snapshot to S3');
        }
    } else {
        // Local Storage
        // Calculate relative path from the actual file location to ensure consistency
        // This avoids relying on req.fileRelativePath which might be lost or inconsistent
        const uploadDir = path.join(__dirname, '../../uploads');
        const relativePath = path.relative(uploadDir, req.file.destination).split(path.sep).join('/');
        
        // Ensure relativePath doesn't start with / if it's empty
        const prefix = relativePath && relativePath !== '.' ? `${relativePath}/` : '';
        
        imageUrl = `/uploads/${prefix}${req.file.filename}`;
    }
    console.log(`[Snapshot] Saved to ${imageUrl}`);
    
    await prisma.screenSnapshot.create({
      data: {
        screenId,
        imageUrl
      }
    });

    await prisma.screenLog.create({
      data: {
        screenId,
        level: 'INFO',
        message: 'Snapshot received from player'
      }
    });

    res.status(200).json({ message: 'Snapshot uploaded', url: imageUrl });
  } catch (error: any) {
    try {
        const screenId = (req as any).user?.id;
        if (screenId) {
            await prisma.screenLog.create({
                data: { screenId, level: 'ERROR', message: `Snapshot Error: ${error.message}` }
            });
        }
    } catch (e) { console.error('Failed to log snapshot error', e); }
    res.status(500).json({ message: error.message });
  }
};
