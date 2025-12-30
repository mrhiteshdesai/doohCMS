import prisma from '../prisma';
import bcrypt from 'bcrypt';
import { User, Role } from '@prisma/client';

export const getUsers = async (tenantId: string) => {
  return prisma.user.findMany({
    where: { 
      tenantId,
      email: { not: 'brandeagles' }
    },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });
};

export const getUser = async (id: string, tenantId: string) => {
  return prisma.user.findFirst({
    where: { id, tenantId },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });
};

export const createUser = async (tenantId: string, data: any) => {
  const { name, email, password, roleId, permissions } = data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        tenantId,
        permissions: typeof permissions === 'string' ? permissions : (permissions ? JSON.stringify(permissions) : null),
      },
    });

    if (roleId) {
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId,
        },
      });
    }

    return user;
  });
};

export const updateUser = async (id: string, tenantId: string, data: any) => {
  const { name, email, password, roleId, permissions, isActive } = data;

  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) throw new Error('User not found');

  const updateData: any = {};
  
  if (name) updateData.name = name;
  if (email) updateData.email = email;

  if (isActive !== undefined) {
    updateData.isActive = isActive;
  }

  if (permissions !== undefined) {
    updateData.permissions = typeof permissions === 'string' ? permissions : (permissions === null ? null : JSON.stringify(permissions));
  }

  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  return prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id },
      data: updateData,
    });

    if (roleId) {
      // Remove existing roles (assuming single role for now based on UI)
      await tx.userRole.deleteMany({
        where: { userId: id },
      });

      await tx.userRole.create({
        data: {
          userId: id,
          roleId,
        },
      });
    }

    return updatedUser;
  });
};

export const deleteUser = async (id: string, tenantId: string) => {
  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) throw new Error('User not found');

  // Cascade delete is not set for UserRole -> User in all cases, but prisma schema usually handles it.
  // We should manually clean up if needed, but schema says onDelete Restrict usually.
  // Schema: UserRole_userId_fkey ... ON DELETE RESTRICT
  // Wait, if it is RESTRICT, we must delete UserRoles first.
  
  return prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({
      where: { userId: id },
    });
    
    return tx.user.delete({
      where: { id },
    });
  });
};
