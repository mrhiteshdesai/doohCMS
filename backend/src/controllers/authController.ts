import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { appEnv } from '../config/env';

export const register = async (req: Request, res: Response) => {
  try {
    if (!appEnv.ALLOW_PUBLIC_REGISTRATION) {
      return res.status(403).json({ message: 'Public registration is disabled' });
    }
    const result = await authService.registerTenant(req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
};
