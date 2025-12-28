import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../prisma';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  // Ensure authHeader is a string and starts with Bearer
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token) as any;
    if (!decoded) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Handle Screen Authentication
    if (decoded.type === 'screen') {
        const screen = await prisma.screen.findUnique({
            where: { id: decoded.id },
            select: { id: true, tenantId: true }
        });

        if (!screen) {
             return res.status(401).json({ message: 'Screen not found' });
        }
        
        req.user = decoded;
        return next();
    }

    // Verify user is still active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { isActive: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User is inactive or no longer exists' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const authorize = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // If user has Super Admin role, allow everything?
    if (req.user.roles && req.user.roles.includes('Super Admin')) {
      return next();
    }

    const hasRole = req.user.roles?.some((role: string) => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  };
};

export const checkPermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Super Admin override
    if (req.user.roles && req.user.roles.includes('Super Admin')) {
      return next();
    }
    
    // Check if user has the specific permission or wildcard
    const userPermissions = req.user.permissions || [];
    
    // 1. Exact match
    if (userPermissions.includes(requiredPermission)) {
        return next();
    }
    
    // 2. Wildcard match (e.g. "team:*" matches "team:create")
    const [module] = requiredPermission.split(':');
    if (userPermissions.includes('*') || userPermissions.includes(`${module}:*`)) {
        return next();
    }

    return res.status(403).json({ message: `Forbidden: Requires ${requiredPermission} permission` });
  };
};
