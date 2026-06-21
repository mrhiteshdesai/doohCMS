import { Request, Response } from 'express';
import * as screenService from '../services/screenService';

// Player Endpoints (Delegated to playerController usually, but kept here if referenced)
export const registerPlayer = async (req: Request, res: Response) => {
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

export const getScreenContent = async (req: Request, res: Response) => {
  try {
    // Authenticated via token middleware which sets req.user.id (screenId)
    const screenId = (req as any).user.id;
    const content = await screenService.getScreenContent(screenId);
    res.status(200).json(content);
  } catch (error: any) {
    if (error.message === 'Screen not found' || error.code === 'P2025') {
        return res.status(401).json({ message: 'Screen not found or deleted' });
    }
    res.status(500).json({ message: error.message });
  }
};

export const exportLogs = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const tenantId = (req as any).user.tenantId;
        const content = await screenService.exportScreenLogs(id, tenantId);
        
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="screen-${id}-logs.txt"`);
        res.send(content);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const sendHeartbeat = async (req: Request, res: Response) => {
  try {
    const { screenId, metadata } = req.body;
    if (!screenId) {
      return res.status(400).json({ message: 'screenId is required' });
    }
    const result = await screenService.processHeartbeat(screenId, metadata);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const sendCommand = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { command, payload } = req.body;
    const tenantId = (req as any).user.tenantId;
    
    await screenService.sendCommand(id, tenantId, command, payload);
    res.status(200).json({ message: 'Command queued successfully' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// CMS Endpoints
export const pairScreen = async (req: Request, res: Response) => {
  try {
    const { code, name, tags, location, orientation, playerType } = req.body;
    const tenantId = (req as any).user.tenantId;
    
    const screen = await screenService.pairScreen(
      code, 
      tenantId, 
      name,
      tags,
      location,
      orientation,
      playerType
    );
    res.status(200).json(screen);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getScreens = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    
    // Check for 'deleted' (frontend) or 'includeDeleted' (api) params
    const showDeletedOnly = req.query.deleted === 'true' || req.query.archived === 'true';
    const includeDeleted = showDeletedOnly || req.query.includeDeleted === 'true';
    const page = Number(req.query.page);
    const pageSize = Number(req.query.pageSize);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const screens = await screenService.getTenantScreens(tenantId, {
      includeDeleted,
      deletedOnly: showDeletedOnly,
      page: Number.isFinite(page) && page > 0 ? page : undefined,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : undefined,
      search,
      status,
    });
    
    // If specifically asking for deleted/archived screens, filter for them
    if (showDeletedOnly && Array.isArray(screens)) {
        const archived = screens.filter(s => s.isDeleted);
        return res.status(200).json(archived);
    }
    
    // Otherwise return active screens (unless includeDeleted was explicitly true without archived/deleted flag)
    // But getTenantScreens already filters by default if includeDeleted is false.
    // If includeDeleted is true but showDeletedOnly is false, we return all (active + deleted).
    
    res.status(200).json(screens);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getScreen = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    const screen = await screenService.getScreenById(id, tenantId);
    res.status(200).json(screen);
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
};

export const getNativeManifest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    const manifest = await screenService.getNativePlaybackManifestForTenant(id, tenantId);
    res.status(200).json(manifest);
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
};

export const updateScreen = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    const screen = await screenService.updateScreen(id, tenantId, req.body);
    res.status(200).json(screen);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteScreen = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    await screenService.deleteScreen(id, tenantId);
    res.status(200).json({ message: 'Screen deleted' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const requestSnapshot = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    const snapshot = await screenService.requestSnapshot(id, tenantId);
    res.status(200).json(snapshot);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const resetScreenContent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    const result = await screenService.resetScreenContent(id, tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const clearCommandHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    await screenService.clearCommandHistory(id, tenantId);
    res.status(200).json({ message: 'Command history cleared' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const publishPlaylist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { playlistId } = req.body;
    const tenantId = (req as any).user.tenantId;
    const screen = await screenService.publishPlaylist(id, tenantId, playlistId);
    res.status(200).json(screen);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const resetContent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    await screenService.resetScreenContent(id, tenantId);
    res.status(200).json({ message: 'Screen content reset' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
