import { Request, Response } from 'express';
import * as dashboardService from '../services/dashboardService';

export const getStats = async (req: Request, res: Response) => {
  try {
    console.log('Dashboard stats requested. User:', req.user);
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      console.log('No tenant ID found for user');
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const stats = await dashboardService.getDashboardStats(tenantId);
    console.log('Stats generated successfully');
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
