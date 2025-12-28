import { Request, Response } from 'express';
import * as tenantService from '../services/tenantService';

export const getSettings = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const settings = await tenantService.getTenantSettings(tenantId);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPublicBranding = async (req: Request, res: Response) => {
  try {
    const branding = await tenantService.getSystemBranding();
    res.json(branding || {});
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    console.log('Updating settings for tenant:', tenantId);
    console.log('Received config:', JSON.stringify(req.body.config, null, 2));
    const settings = await tenantService.updateTenantSettings(tenantId, req.body);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
