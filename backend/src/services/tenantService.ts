import prisma from '../prisma';

export const getTenantSettings = async (tenantId: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true, name: true }
  });

  if (!tenant) throw new Error('Tenant not found');

  return {
    name: tenant.name,
    config: tenant.config || {}
  };
};

export const getSystemBranding = async () => {
  // Fetch the first tenant (assuming single tenant or main tenant for system branding)
  const tenant = await prisma.tenant.findFirst({
    select: { config: true }
  });

  if (!tenant) return null;

  // Filter only branding fields to be safe
  const config = (tenant.config as any) || {};
  return {
    logoUrl: config.logoUrl,
    faviconUrl: config.faviconUrl,
    primaryColor: config.primaryColor,
    loginPage: config.loginPage || {}
  };
};

export const updateTenantSettings = async (tenantId: string, data: any) => {
  const updateData: any = {};
  
  if (data.name) {
    updateData.name = data.name;
  }
  
  if (data.config) {
    updateData.config = data.config;
  }

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    select: { config: true, name: true }
  });

  return {
    name: tenant.name,
    config: tenant.config || {}
  };
};
