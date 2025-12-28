import { Request, Response } from 'express';
import * as scheduleService from '../services/scheduleService';

export const createSchedule = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const schedule = await scheduleService.createSchedule(tenantId, req.body);
    res.status(201).json(schedule);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getSchedules = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { search, targetType, recurrence } = req.query;
    const schedules = await scheduleService.getSchedules(tenantId, {
      search: search as string,
      targetType: targetType as any,
      recurrence: recurrence as any
    });
    res.status(200).json(schedules);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSchedule = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { id } = req.params;
    const schedule = await scheduleService.updateSchedule(id, tenantId, req.body);
    res.status(200).json(schedule);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteSchedule = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { id } = req.params;
    await scheduleService.deleteSchedule(id, tenantId);
    res.status(200).json({ message: 'Deleted' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
