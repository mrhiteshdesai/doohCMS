import { Request, Response } from 'express';
import * as layoutService from '../services/layoutService';

export const createLayout = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const { tenantId } = (req as any).user;
    
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const layout = await layoutService.createLayout(tenantId, name, description);
    res.status(201).json(layout);
  } catch (error) {
    console.error('Error creating layout:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getLayouts = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const { search, sortField, sortDir } = req.query;

    const layouts = await layoutService.getLayouts(
      tenantId,
      { search: search as string },
      { 
        field: (sortField as any) || 'createdAt', 
        direction: (sortDir as any) || 'desc' 
      }
    );
    res.json(layouts);
  } catch (error) {
    console.error('Error fetching layouts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getLayoutById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId } = (req as any).user;
    
    const layout = await layoutService.getLayoutById(id, tenantId);
    if (!layout) {
      return res.status(404).json({ message: 'Layout not found' });
    }
    
    res.json(layout);
  } catch (error) {
    console.error('Error fetching layout:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateLayout = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId } = (req as any).user;
    const result = await layoutService.updateLayout(id, tenantId, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error updating layout:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteLayout = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId } = (req as any).user;

    await layoutService.deleteLayout(id, tenantId);
    res.json({ message: 'Layout deleted' });
  } catch (error) {
    console.error('Error deleting layout:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const bulkDeleteLayouts = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body; // Expecting { ids: string[] }
    const { tenantId } = (req as any).user;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No IDs provided' });
    }

    await layoutService.deleteLayoutsBulk(ids, tenantId);
    res.json({ message: 'Layouts deleted successfully' });
  } catch (error) {
    console.error('Error bulk deleting layouts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
