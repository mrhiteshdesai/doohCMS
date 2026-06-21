import { Request, Response } from 'express';
import * as systemSettingsService from '../services/systemSettingsService';
import { appMetrics } from '../observability/metrics';

export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    const settings = await systemSettingsService.getSystemSettingsForAdmin();
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

export const getRetentionPolicies = async (req: Request, res: Response) => {
  try {
    const policies = await systemSettingsService.getRetentionPolicies();
    res.json(policies);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateRetentionPolicy = async (req: Request, res: Response) => {
  try {
    const { tableName, days } = req.body;
    if (!tableName || typeof days !== 'number') {
      return res.status(400).json({ message: 'tableName and days are required' });
    }
    const result = await systemSettingsService.updateRetentionPolicy(tableName, days);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getObservabilityMetrics = async (req: Request, res: Response) => {
  try {
    res.json(appMetrics.snapshot());
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
