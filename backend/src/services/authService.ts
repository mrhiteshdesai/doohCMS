import prisma from '../prisma';
import bcrypt from 'bcrypt';
import { generateToken } from '../utils/jwt';

export const registerTenant = async (data: any) => {
  const { tenantName, email, password, userName } = data;

  // Transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Tenant
    const tenant = await tx.tenant.create({
      data: { name: tenantName },
    });

    // 2. Create User
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name: userName,
        tenantId: tenant.id,
      },
    });

    // 3. Create/Assign Role (Org Admin)
    const role = await tx.role.create({
      data: {
        name: 'Organization Admin',
        tenantId: tenant.id,
        permissions: '*', // Full access
      },
    });

    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    return { tenant, user };
  });

  return result;
};

export const login = async (data: any) => {
  const { email, password } = data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      tenant: true,
      userRoles: {
        include: { role: true },
      },
    },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error('Invalid credentials');
  }

  if (!user.isActive) {
    throw new Error('User is inactive. Please contact your administrator.');
  }

  // Aggregate permissions
  const rolePermissions = user.userRoles.map(ur => ur.role.permissions).join(',').split(',');
  const userPermissions = (user.permissions || '').split(',');
  const allPermissions = Array.from(new Set([...rolePermissions, ...userPermissions]))
    .map(p => p.trim())
    .filter(Boolean);

  const token = generateToken({
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
    roles: user.userRoles.map((ur) => ur.role.name),
    permissions: allPermissions
  });

  const refreshToken = generateToken({
    id: user.id,
  }, '7d');

  return { 
    token, 
    refreshToken, 
    user: { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      permissions: allPermissions, // Return aggregated permissions
      roles: user.userRoles.map(ur => ur.role)
    } 
  };
};
