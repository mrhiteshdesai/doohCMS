import { Request, Response } from 'express';
import * as userService from '../services/userService';
import prisma from '../prisma';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const users = await userService.getUsers(tenantId);
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tenantId = (req as any).user.tenantId;
    const user = await userService.getUser(userId, tenantId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tenantId = (req as any).user.tenantId;
    const { name, password } = req.body;
    
    // Only allow updating name and password for self-profile
    const updateData: any = {};
    if (name) updateData.name = name;
    if (password) updateData.password = password;

    const user = await userService.updateUser(userId, tenantId, updateData);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getUser = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { id } = req.params;
    const user = await userService.getUser(id, tenantId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const user = await userService.createUser(tenantId, req.body);
    res.status(201).json(user);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { id } = req.params;
    const user = await userService.updateUser(id, tenantId, req.body);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { id } = req.params;
    await userService.deleteUser(id, tenantId);
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getRoles = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const roles = await prisma.role.findMany({
      where: { tenantId },
    });
    res.json(roles);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
