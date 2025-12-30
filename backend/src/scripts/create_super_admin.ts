import dotenv from 'dotenv';
import prisma from '../prisma';
import bcrypt from 'bcrypt';

dotenv.config();

async function main() {
  const email = 'brandeagles';
  const password = '123';
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log(`Setting up super admin user: ${email}`);

  // 1. Find a tenant
  let tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'asc' }
  });

  if (!tenant) {
    console.log('No tenant found. Creating a default tenant...');
    tenant = await prisma.tenant.create({
      data: { name: 'Default Tenant' }
    });
  }

  console.log(`Using tenant: ${tenant.name} (${tenant.id})`);

  // 2. Check/Create User
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  let userId: string;

  if (existingUser) {
    console.log('User already exists. Updating password and permissions...');
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { 
        password: hashedPassword,
        tenantId: tenant.id,
        permissions: '*', // Full permissions
        isActive: true,
      },
    });
    userId = updatedUser.id;
    console.log('User updated.');
  } else {
    console.log('Creating new user...');
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Super Admin',
        tenantId: tenant.id,
        permissions: '*', // Full permissions
        isActive: true,
      },
    });
    userId = newUser.id;
    console.log('User created.');
  }

  // 3. Ensure "Super Admin" role exists and assign it
  let superAdminRole = await prisma.role.findFirst({
    where: { 
      name: 'Super Admin',
      tenantId: tenant.id 
    }
  });

  if (!superAdminRole) {
    console.log('Creating Super Admin role...');
    superAdminRole = await prisma.role.create({
      data: {
        name: 'Super Admin',
        permissions: '*',
        tenantId: tenant.id
      }
    });
  }

  // Assign role
  const existingRoleLink = await prisma.userRole.findUnique({
    where: {
      userId_roleId: {
        userId: userId,
        roleId: superAdminRole.id
      }
    }
  });

  if (!existingRoleLink) {
    console.log('Assigning Super Admin role...');
    await prisma.userRole.create({
      data: {
        userId: userId,
        roleId: superAdminRole.id
      }
    });
  }

  console.log('Super Admin setup complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
