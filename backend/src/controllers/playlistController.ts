import { Request, Response } from 'express';
import * as playlistService from '../services/playlistService';

export const createPlaylist = async (req: Request, res: Response) => {
  try {
    const { name, description, layoutId } = req.body;
    const { tenantId } = (req as any).user;
    
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const playlist = await playlistService.createPlaylist(tenantId, name, description, layoutId);
    res.status(201).json(playlist);
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPlaylists = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const { search, sortField, sortDir } = req.query;

    const playlists = await playlistService.getPlaylists(
      tenantId,
      { search: search as string },
      { 
        field: (sortField as any) || 'createdAt', 
        direction: (sortDir as any) || 'desc' 
      }
    );
    res.json(playlists);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPlaylistById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId } = (req as any).user;
    
    const playlist = await playlistService.getPlaylistById(id, tenantId);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }
    
    res.json(playlist);
  } catch (error) {
    console.error('Error fetching playlist:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updatePlaylist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId } = (req as any).user;
    // Pass entire body to service to handle nested updates (zones/items)
    const result = await playlistService.updatePlaylist(id, tenantId, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error updating playlist:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deletePlaylist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId } = (req as any).user;

    await playlistService.deletePlaylist(id, tenantId);
    res.json({ message: 'Playlist deleted' });
  } catch (error) {
    console.error('Error deleting playlist:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const bulkDeletePlaylists = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body; // Expecting { ids: string[] }
    const { tenantId } = (req as any).user;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No IDs provided' });
    }

    await playlistService.deletePlaylistsBulk(ids, tenantId);
    res.json({ message: 'Playlists deleted successfully' });
  } catch (error) {
    console.error('Error bulk deleting playlists:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
