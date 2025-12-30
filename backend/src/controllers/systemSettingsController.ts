import { Request, Response } from 'express';
import * as systemSettingsService from '../services/systemSettingsService';

export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    const settings = await systemSettingsService.getSystemSettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSystemSettings = async (req: Request, res: Response) => {
  try {
    const settings = await systemSettingsService.updateSystemSettings(req.body);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
