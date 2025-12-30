import dotenv from 'dotenv';
import prisma from '../prisma';
import bcrypt from 'bcrypt';

dotenv.config();

async function main() {
  const adminEmail = 'admin@example.com';
  const newPassword = 'admin123';

  console.log(`Resetting password for ${adminEmail}...`);

  try {
    const user = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!user) {
      console.error('User not found!');
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    console.log(`Password reset successfully to: ${newPassword}`);
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

main();