import dotenv from 'dotenv';
import prisma from '../prisma';
import bcrypt from 'bcrypt';

dotenv.config();

async function main() {
  const adminEmail = 'admin@smartags.com';
  const newPassword = 'admin123';

  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!user) {
    console.error(`User ${adminEmail} not found! Run bootstrap_admin.ts first.`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { email: adminEmail },
    data: { password: hashed },
  });

  console.log(`Password for ${adminEmail} has been reset to: ${newPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
