import { PrismaClient } from '@prisma/client';
import { generatePairingCode } from '../utils/codeGenerator';
import { generateToken } from '../utils/jwt';
import prisma from '../prisma';
import * as systemSettingsService from './systemSettingsService';
import { appMetrics } from '../observability/metrics';
import {
  buildNativeDiagnostics,
  buildNativePlaybackManifest,
  normalizeHeartbeatTelemetry,
  normalizeNativeCommand
} from './nativeFleetService';

// Helper to resolve active schedule (Phase 2.2)
const resolveActiveSchedule = async (screenId: string, tenantId: string) => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    const currentDay = now.getDay().toString(); // 0-6
    
    // Find candidate schedules
    const schedules = await prisma.schedule.findMany({
        where: {
            tenantId,
            startDate: { lte: now },
            AND: [
                {
                    OR: [
                        { screenId },
                        { group: { members: { some: { screenId } } } }
                    ]
                },
                {
                    OR: [
                        { endDate: null },
                        { endDate: { gte: now } }
                    ]
                }
            ]
        },
        orderBy: { priority: 'desc' } // High priority first
    });

    // Filter by Time & Day (Dayparting)
    const activeSchedule = schedules.find(schedule => {
        // Check Days of Week
        if (schedule.daysOfWeek && !schedule.daysOfWeek.split(',').includes(currentDay)) {
            return false;
        }

        // Check Time Range
        if (schedule.startTime && schedule.endTime) {
            return isTimeInRange(currentTime, schedule.startTime, schedule.endTime);
        }

        return true;
    });

    return activeSchedule;
};

// Helper: Handle overnight schedules (e.g. 22:00 to 02:00)
const isTimeInRange = (current: string, start: string, end: string) => {
    if (start <= end) {
        return current >= start && current <= end;
    } else {
        // Overnight: 22:00 -> 02:00. Current 23:00 is valid. Current 01:00 is valid.
        return current >= start || current <= end;
    }
};

// Helper to create screen logs
export const createLog = async (screenId: string, level: 'INFO' | 'WARN' | 'ERROR', message: string) => {
  try {
    await prisma.screenLog.create({
      data: {
        screenId,
        level,
        message
      }
    });
  } catch (error) {
    console.error('Failed to create screen log:', error);
  }
};

const serializePlayerPlaylist = (playlist: any) => {
  if (!playlist) return null;

  return {
    ...playlist,
    zones: Array.isArray(playlist.zones)
      ? playlist.zones.map((zone: any) => ({
          ...zone,
          items: Array.isArray(zone.items)
            ? zone.items.map((item: any) => ({
                ...item,
                media: item.media
                  ? {
                      ...item.media,
                      filename: item.media.name,
                      sha256: item.media.sha256 ?? null
                    }
                  : null
              }))
            : []
        }))
      : []
  };
};

type ScreenListOptions = {
  includeDeleted?: boolean;
  deletedOnly?: boolean;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
};

const parseScreenRecord = (screen: any) => {
  let tags = [];
  try {
    tags = screen.tags ? JSON.parse(screen.tags) : [];
  } catch (e) {
    console.warn(`Failed to parse tags for screen ${screen.id}`, e);
  }

  let location = null;
  try {
    location = screen.location ? JSON.parse(screen.location) : null;
  } catch (e) {
    console.warn(`Failed to parse location for screen ${screen.id}`, e);
  }

  return {
    ...screen,
    tags,
    location,
    nativeDiagnostics: buildNativeDiagnostics(screen)
  };
};

const buildScreenSummary = (screens: any[]) =>
  screens.reduce(
    (summary, screen) => {
      const telemetry = screen?.config?.telemetry || {};
      summary.total += 1;
      if (screen.status === 'ONLINE') {
        summary.online += 1;
      } else {
        summary.offline += 1;
      }
      if (screen.playerType === 'Android' || `${telemetry.platform || ''}`.toLowerCase().includes('native')) {
        summary.native += 1;
      }
      if (telemetry.deviceOwnerState === 'DEVICE_OWNER') {
        summary.deviceOwner += 1;
      }
      if (telemetry.downloadState === 'DOWNLOADING' || telemetry.downloadProgress?.status === 'DOWNLOADING') {
        summary.downloading += 1;
      }
      return summary;
    },
    {
      total: 0,
      online: 0,
      offline: 0,
      native: 0,
      deviceOwner: 0,
      downloading: 0
    }
  );

// Player: Register device and get pairing code
export const registerPlayerDevice = async () => {
  let code = generatePairingCode();
  // Ensure uniqueness
  while (await prisma.screenPairingCode.findUnique({ where: { code } })) {
    code = generatePairingCode();
  }

  // Create Screen and PairingCode in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create pairing code first
    const pairingCode = await tx.screenPairingCode.create({
      data: { code }
    });
    
    // Create screen associated with it
    const screen = await tx.screen.create({
      data: {
        pairingCodeId: pairingCode.id,
        status: 'UNPAIRED'
      }
    });
    
    await tx.screenPairingCode.update({
      where: { id: pairingCode.id },
      data: { screenId: screen.id }
    });

    return { screenId: screen.id, code };
  });

  return result;
};

// Player: Check Pairing Status
export const checkPairingStatus = async (code: string) => {
  const pairingCode = await prisma.screenPairingCode.findUnique({
    where: { code },
    include: { screen: true }
  });

  if (!pairingCode || !pairingCode.screen) {
    throw new Error('Invalid pairing code');
  }

  const screen = pairingCode.screen;

  if (screen.isDeleted || screen.status === 'DELETED') {
    throw new Error('Invalid pairing code');
  }

  if (screen.tenantId) {
    // Paired! Issue Token
    const token = generateToken({
      id: screen.id,
      tenantId: screen.tenantId,
      type: 'screen'
    }, '365d'); // Long-lived token for screens

    return {
      status: 'PAIRED',
      token,
      screen: {
        id: screen.id,
        name: screen.name,
        orientation: screen.orientation,
        location: screen.location,
        config: screen.config
      }
    };
  }

  return { status: 'PENDING' };
};

// Player: Heartbeat
export const processHeartbeat = async (screenId: string, metadata?: any) => {
  appMetrics.recordHeartbeat();
  // Update screen status and potentially store telemetry in config for quick access
  const screen = await prisma.screen.findUnique({ where: { id: screenId } });
  
  if (!screen) {
      throw new Error('Screen not found');
  }

  if (screen.isDeleted) {
      throw new Error('Screen is deleted');
  }
  
  const normalizedMetadata = normalizeHeartbeatTelemetry(metadata);
  let newConfig = screen?.config as any || {};
  if (Object.keys(normalizedMetadata).length > 0) {
    const currentTelemetry = newConfig.telemetry || {};
    // Merge telemetry to preserve fields not present in current metadata (like cachedFiles if not sent every time)
    newConfig = {
      ...newConfig,
      telemetry: {
        ...currentTelemetry,
        ...normalizedMetadata
      }
    };
  }

  // Check for pending commands to return to the player
  let pendingCommands = newConfig.pendingCommands || [];

  // Phase 2.2: Advanced Scheduling - Check if there are active schedules for this screen
  // If so, we should prioritize scheduled playlists over the default one
  // This logic is simplified: The backend resolves the active schedule and tells the player "Play this playlist"
  try {
      if (screen.tenantId) {
        const activeSchedule = await resolveActiveSchedule(screenId, screen.tenantId);
        if (activeSchedule) {
          // Check if the player is already playing this playlist
          // The player sends 'currentPlaylistId' in telemetry (metadata)
          const currentPlaylistId = normalizedMetadata?.currentPlaylistId;
          
          if (currentPlaylistId !== activeSchedule.playlistId) {
              console.log(`[Scheduler] Screen ${screenId} should play scheduled playlist ${activeSchedule.playlistId}`);
              
              // Create a 'PLAY_PLAYLIST' command if not already pending
              const alreadyPending = pendingCommands.find((c: any) => 
                  c.type === 'PLAY_PLAYLIST' && c.payload?.playlistId === activeSchedule.playlistId
              );
              
              if (!alreadyPending) {
                   const newCommand = {
                      id: Date.now().toString(),
                      type: 'PLAY_PLAYLIST',
                      payload: { playlistId: activeSchedule.playlistId },
                      status: 'PENDING',
                      createdAt: new Date(),
                      updatedAt: new Date()
                   };
                   
                   pendingCommands.push(newCommand);
                   
                   // Also add to history
                   const history = newConfig.commandHistory || [];
                   history.unshift(newCommand);
                   if (history.length > 50) history.pop();
                   newConfig.commandHistory = history;
              }
          }
        }
      }
  } catch (err) {
      console.error('Failed to resolve schedule', err);
  }

  // SELF-HEALING: Check for stuck SENT commands (older than 2 minutes) and re-queue them
  const history = newConfig.commandHistory || [];
  let historyChanged = false;
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  
  history.forEach((cmd: any) => {
      if (cmd.status === 'SENT' && new Date(cmd.updatedAt) < twoMinutesAgo) {
          console.log(`[Heartbeat] Re-queuing stuck command ${cmd.id} (${cmd.type})`);
          cmd.status = 'PENDING';
          cmd.updatedAt = new Date();
          // Add back to pending if not already there
          if (!pendingCommands.find((p: any) => p.id === cmd.id)) {
              pendingCommands.push(cmd);
          }
          historyChanged = true;
      }
  });
  
  if (historyChanged) {
      newConfig.commandHistory = history;
      // We don't need to save newConfig here as it will be saved at the end of function
  }
  
  // Handle command updates from player
  if (normalizedMetadata && normalizedMetadata.commandUpdates && Array.isArray(normalizedMetadata.commandUpdates)) {
    const history = newConfig.commandHistory || [];
    normalizedMetadata.commandUpdates.forEach((update: any) => {
      const cmd = history.find((c: any) => c.id === update.id);
      if (cmd) {
        cmd.status = update.status;
        cmd.updatedAt = new Date();
        if (update.message) cmd.message = update.message;
      }
    });
    newConfig.commandHistory = history;
  }
  
  // Clear pending commands from config if they are being sent
  if (pendingCommands.length > 0) {
     console.log(`[Heartbeat] Sending ${pendingCommands.length} commands to screen ${screenId}`);
     newConfig.pendingCommands = [];
     
     // Also mark them as SENT in history if they are still PENDING
     const history = newConfig.commandHistory || [];
     pendingCommands.forEach((pc: any) => {
        const cmd = history.find((c: any) => c.id === pc.id);
        if (cmd && cmd.status === 'PENDING') {
            cmd.status = 'SENT';
            cmd.updatedAt = new Date();
        }
     });
     newConfig.commandHistory = history;
  }

  // Cleanup old completed/failed commands (older than 5 minutes)
  if (newConfig.commandHistory && newConfig.commandHistory.length > 0) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      newConfig.commandHistory = newConfig.commandHistory.filter((cmd: any) => {
          // Keep if not final state
          if (cmd.status !== 'COMPLETED' && cmd.status !== 'FAILED') return true;
          
          // If final state, check time
          const updatedAt = new Date(cmd.updatedAt);
          return updatedAt > fiveMinutesAgo;
      });
  }

  if (screen?.status !== 'ONLINE') {
      await createLog(screenId, 'INFO', 'Screen is back ONLINE');
  }

   // Log download status
   if (normalizedMetadata && normalizedMetadata.downloadProgress) {
      const prevTelemetry = (screen?.config as any)?.telemetry;
      const prevStatus = prevTelemetry?.downloadProgress?.status;
      const currentStatus = normalizedMetadata.downloadProgress.status;
      
      if (currentStatus === 'DOWNLOADING' && prevStatus !== 'DOWNLOADING') {
          await createLog(screenId, 'INFO', 'Started downloading media');
      }
   }

  // Log failed commands
  if (normalizedMetadata && normalizedMetadata.commandUpdates) {
      normalizedMetadata.commandUpdates.forEach((update: any) => {
          if (update.status === 'FAILED') {
              createLog(screenId, 'ERROR', `Command ${update.id} failed: ${update.message || 'Unknown error'}`);
          } else if (update.status === 'COMPLETED') {
              createLog(screenId, 'INFO', `Command ${update.id} completed`);
          }
      });
  }

  // Log download reports
  if (normalizedMetadata && normalizedMetadata.downloadReports && Array.isArray(normalizedMetadata.downloadReports)) {
      const reports = normalizedMetadata.downloadReports;
      const mediaIds = reports.map((r: any) => r.fileId).filter((id: any) => typeof id === 'string');
      
      let mediaMap = new Map<string, string>();
      if (mediaIds.length > 0) {
          try {
            const mediaFiles = await prisma.mediaFile.findMany({
                where: { id: { in: mediaIds } },
                select: { id: true, name: true }
            });
            mediaMap = new Map(mediaFiles.map((m: any) => [m.id, m.name]));
          } catch (e) {
              console.error('Failed to resolve media names for logs', e);
          }
      }

      for (const report of reports) {
          const name = mediaMap.get(report.fileId) || report.fileId;
          if (report.status === 'FAILED') {
              await createLog(screenId, 'ERROR', `Media download failed: ${name} - ${report.message || 'Unknown error'}`);
          } else if (report.status === 'SUCCESS') {
               await createLog(screenId, 'INFO', `Media download success: ${name}`);
          }
      }
  }

  try {
    const systemSettings = await systemSettingsService.getSystemSettings();
    if (systemSettings && systemSettings.traffic) {
      newConfig.traffic = systemSettings.traffic;
    }
  } catch (err) {
    console.error('Failed to inject traffic settings', err);
  }

  // Handle Telemetry Data
  const telemetryData: any = {};
  if (normalizedMetadata) {
      if (normalizedMetadata.cpuTemp !== undefined) telemetryData.cpuTemp = normalizedMetadata.cpuTemp;
      if (normalizedMetadata.freeStorageBytes !== undefined) telemetryData.freeDiskSpace = normalizedMetadata.freeStorageBytes;
      if (normalizedMetadata.totalStorageBytes !== undefined) telemetryData.totalDiskSpace = normalizedMetadata.totalStorageBytes;
      if (normalizedMetadata.memoryUsedBytes !== undefined) telemetryData.usedMemory = normalizedMetadata.memoryUsedBytes;
      if (normalizedMetadata.memoryTotalBytes !== undefined) telemetryData.totalMemory = normalizedMetadata.memoryTotalBytes;
      if (normalizedMetadata.appVersion !== undefined) telemetryData.appVersion = normalizedMetadata.appVersion;
      
      // Alerting Logic: Low Disk Space (< 1GB)
      // 1 GB = 1024 * 1024 * 1024 bytes
      const MIN_DISK_SPACE = 1073741512; 
      if (normalizedMetadata.freeStorageBytes && normalizedMetadata.freeStorageBytes < MIN_DISK_SPACE) {
          // Check if we already alerted recently (simple throttle mechanism could be added here)
          console.warn(`[Alert] Screen ${screenId} has low disk space: ${(normalizedMetadata.freeStorageBytes / 1024 / 1024).toFixed(2)} MB`);
          // TODO: Implement email/slack alert
          await createLog(screenId, 'WARN', `Low Disk Space: ${(normalizedMetadata.freeStorageBytes / 1024 / 1024).toFixed(2)} MB remaining`);
      }
  }

  if (Object.keys(telemetryData).length > 0) {
      telemetryData.lastTelemetryAt = new Date();
  }

  await prisma.screen.update({
      where: { id: screenId },
      data: {
        lastSeenAt: new Date(),
        status: 'ONLINE',
        config: newConfig,
        ...telemetryData
      }
  });

  return { status: 'ok', commands: pendingCommands, config: newConfig };
};

export const sendCommand = async (screenId: string, tenantId: string, command: string, payload?: any) => {
  const screen = await prisma.screen.findUnique({ where: { id: screenId } });
  if (!screen || screen.tenantId !== tenantId) {
    throw new Error('Screen not found or unauthorized');
  }

  const normalizedCommand = normalizeNativeCommand(command, payload);

  const config = (screen.config as any) || {};
  const pendingCommands = config.pendingCommands || [];
  const commandHistory = config.commandHistory || [];
  
  const newCommand = {
    id: Date.now().toString(),
    type: normalizedCommand.type,
    payload: normalizedCommand.payload,
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  pendingCommands.push(newCommand);
  commandHistory.unshift(newCommand); // Add to top of history

  // Limit history size to 50
  if (commandHistory.length > 50) {
    commandHistory.pop();
  }

  console.log(`[Command] Queued ${normalizedCommand.type} for screen ${screenId}`);
  appMetrics.recordCommandQueued();

  await createLog(screenId, 'INFO', `Command ${normalizedCommand.type} queued`);

  return prisma.screen.update({
    where: { id: screenId },
    data: {
      config: {
        ...config,
        pendingCommands,
        commandHistory
      }
    }
  });
};

export const clearCommandHistory = async (screenId: string, tenantId: string) => {
  const screen = await prisma.screen.findUnique({ where: { id: screenId } });
  if (!screen || screen.tenantId !== tenantId) {
    throw new Error('Screen not found or unauthorized');
  }

  const config = (screen.config as any) || {};
  // let commandHistory = config.commandHistory || []; // Removed to avoid conflict

  // Clear ALL commands (history and pending)
  // This effectively resets the command queue
  const pendingCommands: any[] = [];
  const commandHistory: any[] = [];

  return prisma.screen.update({
    where: { id: screenId },
    data: {
      config: {
        ...config,
        pendingCommands,
        commandHistory
      }
    }
  });
};

// CMS: Pair Screen
export const pairScreen = async (
  code: string, 
  tenantId: string, 
  name: string, 
  tags?: string[], 
  location?: any,
  orientation?: string,
  playerType?: string
) => {
  const pairingCode = await prisma.screenPairingCode.findUnique({
    where: { code },
    include: { screen: true }
  });

  if (!pairingCode || !pairingCode.screen) {
    throw new Error('Invalid pairing code');
  }

  if (pairingCode.screen.tenantId) {
    throw new Error('Screen already paired');
  }

  // Parse location if it's an object with lat/lng
  let latitude: number | undefined;
  let longitude: number | undefined;
  let locationString: string | undefined = undefined;

  if (location) {
    if (typeof location === 'object') {
      latitude = location.lat;
      longitude = location.lng;
      locationString = JSON.stringify(location);
    } else {
      locationString = location;
    }
  }

  // Update Screen
  const updatedScreen = await prisma.screen.update({
    where: { id: pairingCode.screen.id },
    data: {
      tenantId,
      name,
      status: 'ONLINE',
      tags: tags ? JSON.stringify(tags) : undefined,
      location: locationString,
      latitude,
      longitude,
      orientation: orientation || 'LANDSCAPE',
      playerType,
      // Phase 2.1: Inject traffic settings on pair
      config: {
         ...((pairingCode.screen.config as any) || {}),
         traffic: (await systemSettingsService.getSystemSettings())?.traffic
      }
    }
  });

  await createLog(updatedScreen.id, 'INFO', 'Screen paired successfully');

  return updatedScreen;
};

// CMS: Update Screen
export const updateScreen = async (screenId: string, tenantId: string, data: any) => {
  const { name, orientation, tags, location, playerType, config } = data;
  
  // Verify ownership
  const screen = await prisma.screen.findUnique({
    where: { id: screenId }
  });

  if (!screen || screen.tenantId !== tenantId) {
    throw new Error('Screen not found or unauthorized');
  }

  // Parse location
  let latitude: number | undefined;
  let longitude: number | undefined;
  let locationString: string | undefined = undefined;

  if (location) {
      if (typeof location === 'object') {
          latitude = location.lat;
          longitude = location.lng;
          locationString = JSON.stringify(location);
      } else {
          locationString = location;
      }
  }

  return prisma.screen.update({
    where: { id: screenId },
    data: {
      name,
      orientation,
      tags: tags ? JSON.stringify(tags) : undefined,
      location: locationString,
      latitude,
      longitude,
      playerType,
      config: config ?? undefined // Only update if provided
    }
  });
};

// CMS: Delete Screen
export const deleteScreen = async (screenId: string, tenantId: string) => {
  // Verify ownership
  const screen = await prisma.screen.findUnique({
    where: { id: screenId }
  });

  if (!screen || screen.tenantId !== tenantId) {
    throw new Error('Screen not found or unauthorized');
  }

  // Transaction to clean up pairing code association and related data
  return prisma.$transaction(async (tx: any) => {
    // 1. Unlink Pairing Code if exists
    if (screen.pairingCodeId) {
      await tx.screenPairingCode.update({
        where: { id: screen.pairingCodeId },
        data: { screenId: null }
      });
    }

    // 2. Remove from Groups (active association)
    await tx.screenGroupMember.deleteMany({ where: { screenId } });

    // 3. Remove from Schedules (active association)
    await tx.schedule.updateMany({
      where: { screenId },
      data: { screenId: null }
    });

    // 4. Soft Delete the screen
    // We RETAIN ProofOfPlay, Logs, Snapshots, etc. for archive/history
    return tx.screen.update({
      where: { id: screenId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: 'DELETED',
        pairingCodeId: null,
        activePlaylistId: null
      }
    });
  });
};

// CMS: Reset Screen Content
export const resetScreenContent = async (screenId: string, tenantId: string) => {
  const screen = await prisma.screen.findUnique({ where: { id: screenId } });
  if (!screen || screen.tenantId !== tenantId) {
    throw new Error('Screen not found or unauthorized');
  }

  // 1. Unassign playlist
  await prisma.screen.update({
    where: { id: screenId },
    data: { activePlaylistId: null }
  });

  // 2. Queue commands to clear cache and reset state
  // We send CLEAR_CACHE to wipe files
  await sendCommand(screenId, tenantId, 'CLEAR_CACHE');
  
  // We send RELOAD to make sure it picks up the "no playlist" state immediately
  await sendCommand(screenId, tenantId, 'RELOAD');

  await createLog(screenId, 'WARN', 'Screen content reset (playlist unassigned, cache cleared)');

  return { message: 'Screen content reset successfully' };
};

// CMS: Request Snapshot
export const requestSnapshot = async (screenId: string, tenantId: string) => {
  // Verify ownership
  const screen = await prisma.screen.findUnique({
    where: { id: screenId }
  });

  if (!screen || screen.tenantId !== tenantId) {
    throw new Error('Screen not found or unauthorized');
  }

  // Queue SNAPSHOT command for the player
  await sendCommand(screenId, tenantId, 'SNAPSHOT');
  
  await createLog(screenId, 'INFO', 'Snapshot requested');

  // Return a status indicating the request is queued
  // The frontend should poll for new snapshots or listen for updates
  return { status: 'queued', message: 'Snapshot requested' };
};

// CMS: Get Screens
export const getTenantScreens = async (tenantId: string, options: boolean | ScreenListOptions = false) => {
  const normalizedOptions =
    typeof options === 'boolean'
      ? { includeDeleted: options }
      : options;
  const includeDeleted = !!normalizedOptions.includeDeleted;
  const deletedOnly = !!normalizedOptions.deletedOnly;
  const page = normalizedOptions.page && normalizedOptions.page > 0 ? normalizedOptions.page : undefined;
  const pageSize = normalizedOptions.pageSize && normalizedOptions.pageSize > 0
    ? Math.min(normalizedOptions.pageSize, 100)
    : undefined;
  const search = normalizedOptions.search?.trim();
  const status = normalizedOptions.status?.trim().toUpperCase();

  const where: any = { tenantId };
  if (deletedOnly) {
    where.isDeleted = true;
  } else if (!includeDeleted) {
    where.isDeleted = false;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status && status !== 'ALL') {
    where.status = status === 'OFFLINE' ? { not: 'ONLINE' } : status;
  }

  const query = {
    where,
    orderBy: { lastSeenAt: 'desc' as const },
    include: {
      activePlaylist: true
    }
  };

  if (!page || !pageSize) {
    const screens = await prisma.screen.findMany(query);
    return screens.map(parseScreenRecord);
  }

  const [totalItems, screens, summaryScreens] = await Promise.all([
    prisma.screen.count({ where }),
    prisma.screen.findMany({
      ...query,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.screen.findMany({
      where,
      select: {
        status: true,
        playerType: true,
        config: true,
      }
    })
  ]);

  return {
    items: screens.map(parseScreenRecord),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
    },
    summary: buildScreenSummary(summaryScreens)
  };
};

export const getScreenById = async (screenId: string, tenantId: string) => {
  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    include: {
      activePlaylist: true,
      logs: {
        take: 50,
        orderBy: { createdAt: 'desc' }
      },
      snapshots: {
        take: 10,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!screen || screen.tenantId !== tenantId) {
    throw new Error('Screen not found');
  }

  return {
    ...screen,
    tags: screen.tags ? JSON.parse(screen.tags) : [],
    location: screen.location ? JSON.parse(screen.location) : null,
    nativeDiagnostics: buildNativeDiagnostics(screen)
  };
};

// CMS: Publish Playlist to Screen
export const publishPlaylist = async (screenId: string, tenantId: string, playlistId: string | null) => {
  // Verify ownership of screen
  const screen = await prisma.screen.findFirst({ where: { id: screenId, tenantId } });
  if (!screen) throw new Error('Screen not found');

  if (playlistId) {
    const playlist = await prisma.playlist.findFirst({ where: { id: playlistId, tenantId } });
    if (!playlist) throw new Error('Playlist not found');
    await createLog(screenId, 'INFO', `Playlist published: ${playlist.name}`);
  } else {
    await createLog(screenId, 'INFO', 'Playlist unpublished');
  }

  return prisma.screen.update({
    where: { id: screenId },
    data: { activePlaylistId: playlistId }
  });
};

// Player: Get Screen Content
export const getScreenContent = async (screenId: string) => {
  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    include: {
      activePlaylist: {
        include: {
          zones: {
            include: {
              items: {
                include: {
                  media: true,
                  widget: true
                },
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      }
    }
  });

  if (!screen || screen.isDeleted || screen.status === 'DELETED') throw new Error('Screen not found');

  let parsedLocation: any = null;
  if (screen.location) {
    try {
      parsedLocation = JSON.parse(screen.location);
    } catch {
      parsedLocation = screen.location;
    }
  }

  let scheduledPlaylist: any = null;

  if (screen.tenantId) {
    const memberships = await prisma.screenGroupMember.findMany({
      where: { screenId },
      select: { groupId: true }
    });
    const groupIds = memberships.map(m => m.groupId);

    const orTargets: any[] = [{ screenId }];
    if (groupIds.length > 0) {
      orTargets.push({ groupId: { in: groupIds } });
    }
    const candidates = await prisma.schedule.findMany({
      where: {
        tenantId: screen.tenantId,
        OR: orTargets
      },
      orderBy: { createdAt: 'desc' }
    });

    const getTzComponents = (timezone?: string | null) => {
      if (!timezone) {
        const now = new Date();
        const hh = `${now.getHours()}`.padStart(2, '0');
        const mm = `${now.getMinutes()}`.padStart(2, '0');
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dow = nowDate.getDay();
        return { hh, mm, nowDate, dow };
      }
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour12: false,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      });
      const parts = formatter.formatToParts(new Date());
      const map = new Map(parts.map(p => [p.type, p.value]));
      const year = parseInt(map.get('year') || '0', 10);
      const month = parseInt(map.get('month') || '1', 10);
      const day = parseInt(map.get('day') || '1', 10);
      const hour = parseInt(map.get('hour') || '0', 10);
      const minute = parseInt(map.get('minute') || '0', 10);
      const hh = `${hour}`.padStart(2, '0');
      const mm = `${minute}`.padStart(2, '0');
      const nowDate = new Date(year, month - 1, day);
      const dow = nowDate.getDay();
      return { hh, mm, nowDate, dow };
    };

    const isDateInRange = (startDate: Date, endDate: Date | null, recurrence: string, nowDate: Date) => {
      const s = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const e = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) : null;
      if (recurrence === 'ONE_TIME') {
        return nowDate.getTime() === s.getTime();
      }
      if (nowDate < s) return false;
      if (e && nowDate > e) return false;
      return true;
    };

    const isDayMatch = (recurrence: string, daysOfWeek?: string | null, dow?: number) => {
      if (recurrence === 'NONE' || recurrence === 'ONE_TIME' || recurrence === undefined) return true;
      if (recurrence === 'DAILY') return true;
      if (dow === undefined || dow === null) return false;
      if (recurrence === 'WEEKDAY') return dow >= 1 && dow <= 5;
      if (recurrence === 'WEEKEND') return dow === 0 || dow === 6;
      if (recurrence === 'SPECIFIC_DAYS') {
        if (!daysOfWeek) return false;
        try {
          const arr = JSON.parse(daysOfWeek) as number[];
          return Array.isArray(arr) && arr.includes(dow);
        } catch {
          return false;
        }
      }
      return false;
    };

    const isTimeInRange = (startTime: string | null | undefined, endTime: string | null | undefined, nowTime: string) => {
      if (!startTime) return false;
      if (endTime) {
        if (startTime > endTime) {
           // Overnight schedule (e.g. 22:00 -> 05:00)
           return nowTime >= startTime || nowTime <= endTime;
        }
        return startTime <= nowTime && nowTime <= endTime;
      }
      return nowTime >= startTime;
    };

    const active = candidates.filter(s => {
      const { hh, mm, nowDate, dow } = getTzComponents((s as any).timezone);
      const nowTime = `${hh}:${mm}`;
      if (!isDateInRange(s.startDate, s.endDate ?? null, s.recurrence as any, nowDate)) return false;
      if (!isDayMatch(s.recurrence as any, s.daysOfWeek as any, dow)) return false;
      if (!isTimeInRange(s.startTime, (s.endTime || '') as string, nowTime)) return false;
      return true;
    });

    active.sort((a: any, b: any) => {
      const ap = (a.priority ?? 0) as number;
      const bp = (b.priority ?? 0) as number;
      if (ap !== bp) return bp - ap;
      const aScreen = a.screenId === screenId ? 1 : 0;
      const bScreen = b.screenId === screenId ? 1 : 0;
      if (aScreen !== bScreen) return bScreen - aScreen;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (active.length > 0) {
      const first = active[0];
      scheduledPlaylist = await prisma.playlist.findUnique({
        where: { id: first.playlistId },
        include: {
          zones: {
            include: {
              items: {
                include: { media: true, widget: true },
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      });
    }
  }

  // Fetch tenant keys to pass to player
  let tenantKeys: any = {};
  let defaultPlaylist: any = null;

  if (screen.tenantId) {
      const tenant = await prisma.tenant.findUnique({
          where: { id: screen.tenantId },
          select: { config: true }
      });
      if (tenant && tenant.config) {
          const config = tenant.config as any;
          tenantKeys = {
              googleMapsApiKey: config.googleMapsApiKey,
              weatherApiKey: config.weatherApiKey,
              newsFeedUrls: Array.isArray(config.newsFeedUrls) ? config.newsFeedUrls : []
          };

          // Check for default playlist if nothing else is playing (Priority 0)
          if (!scheduledPlaylist && !screen.activePlaylist && config.defaultPlaylistId) {
              try {
                  defaultPlaylist = await prisma.playlist.findUnique({
                      where: { id: config.defaultPlaylistId },
                      include: {
                          zones: {
                              include: {
                                  items: {
                                      include: { media: true, widget: true },
                                      orderBy: { order: 'asc' }
                                  }
                              }
                          }
                      }
                  });
              } catch (e) {
                  console.warn(`Failed to load default playlist ${config.defaultPlaylistId}`, e);
              }
          }
      }
  }

  return {
    screenId: screen.id,
    name: screen.name,
    orientation: screen.orientation,
    location: parsedLocation,
    latitude: screen.latitude,
    longitude: screen.longitude,
    config: screen.config,
    playlist: serializePlayerPlaylist(scheduledPlaylist || screen.activePlaylist || defaultPlaylist),
    ...tenantKeys
  };
};

export const getNativePlaybackManifest = async (screenId: string) => {
  const [screen, content] = await Promise.all([
    prisma.screen.findUnique({ where: { id: screenId } }),
    getScreenContent(screenId)
  ]);

  if (!screen) {
    throw new Error('Screen not found');
  }

  return buildNativePlaybackManifest(screen, content);
};

export const getNativePlaybackManifestForTenant = async (screenId: string, tenantId: string) => {
  const screen = await prisma.screen.findUnique({ where: { id: screenId } });
  if (!screen || screen.tenantId !== tenantId) {
    throw new Error('Screen not found');
  }

  const content = await getScreenContent(screenId);
  return buildNativePlaybackManifest(screen, content);
};

export const exportScreenLogs = async (screenId: string, tenantId: string) => {
  const screen = await prisma.screen.findUnique({ where: { id: screenId } });
  if (!screen || screen.tenantId !== tenantId) {
    throw new Error('Screen not found');
  }

  const logs = await prisma.screenLog.findMany({
    where: { screenId },
    orderBy: { createdAt: 'desc' },
    take: 5000
  });

  return logs.map(log => {
      return `[${log.createdAt.toISOString()}] [${log.level}] ${log.message}`;
  }).join('\n');
};
