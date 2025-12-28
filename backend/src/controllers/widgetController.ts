import { Request, Response } from 'express';
import * as widgetService from '../services/widgetService';

export const getWidgets = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const widgets = await widgetService.getTenantWidgets(tenantId);
    res.status(200).json(widgets);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createWidget = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    console.log('Creating widget with body:', JSON.stringify(req.body, null, 2));
    const widget = await widgetService.createWidget(tenantId, req.body);
    res.status(201).json(widget);
  } catch (error: any) {
    console.error('Error creating widget:', error);
    res.status(400).json({ message: error.message });
  }
};

export const getWidget = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    const widget = await widgetService.getWidget(id, tenantId);
    res.status(200).json(widget);
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
};

export const updateWidget = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    const widget = await widgetService.updateWidget(id, tenantId, req.body);
    res.status(200).json(widget);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteWidget = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user.tenantId;
    await widgetService.deleteWidget(id, tenantId);
    res.status(200).json({ message: 'Widget deleted' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};