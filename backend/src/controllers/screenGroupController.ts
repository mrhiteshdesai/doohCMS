import { Request, Response } from 'express';
import * as screenGroupService from '../services/screenGroupService';

export const createGroup = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const group = await screenGroupService.createGroup(tenantId, req.body);
    res.status(201).json(group);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getGroups = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const groups = await screenGroupService.getGroups(tenantId);
    res.json(groups);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getGroupById = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const { id } = req.params;
    const group = await screenGroupService.getGroupById(tenantId, id);
    res.json(group);
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
};

export const updateGroup = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const { id } = req.params;
    const group = await screenGroupService.updateGroupSafe(tenantId, id, req.body);
    res.json(group);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteGroup = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const { id } = req.params;
    await screenGroupService.deleteGroup(tenantId, id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const assignScreens = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const { id } = req.params;
    const { screenIds } = req.body; // Expecting { screenIds: ["id1", "id2"] }
    
    if (!Array.isArray(screenIds)) {
      return res.status(400).json({ message: 'screenIds must be an array' });
    }

    const result = await screenGroupService.assignScreens(tenantId, id, screenIds);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const publishPlaylist = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const { id } = req.params;
    const { playlistId } = req.body;
    
    const result = await screenGroupService.publishPlaylist(tenantId, id, playlistId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
