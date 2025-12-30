import dotenv from 'dotenv';
import prisma from '../prisma';
import bcrypt from 'bcrypt';

dotenv.config();

async function main() {
  const tenantName = process.env.ADMIN_TENANT_NAME || 'Default Tenant';
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Admin';

  if (!adminEmail || !adminPassword) {
    console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log('Admin user already exists:', existing.email);
    process.exit(0);
  }

  const result = await prisma.$transaction(async (tx: any) => {
    const tenant = await tx.tenant.create({ data: { name: tenantName } });
    const hashed = await bcrypt.hash(adminPassword, 10);
    const user = await tx.user.create({
      data: { email: adminEmail, password: hashed, name: adminName, tenantId: tenant.id }
    });
    const role = await tx.role.create({
      data: { name: 'Organization Admin', tenantId: tenant.id, permissions: '*' }
    });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    return { tenant, user };
  });

  console.log('Admin created', result.user.email);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
