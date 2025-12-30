import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('--- DIAGNOSTIC START ---');
  
  // 1. Check DB for User
  const email = 'admin@smartags.com';
  const password = 'admin123';
  
  console.log(`Checking for user: ${email}`);
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error('❌ User NOT found in database!');
    return;
  }
  console.log('✅ User found in database.');
  console.log(`   ID: ${user.id}`);
  console.log(`   TenantID: ${user.tenantId}`);
  // console.log(`   Role: ${user.role}`);
  console.log(`   Password Hash: ${user.password.substring(0, 10)}...`);

  // 2. Verify Password Hash
  console.log(`Verifying password '${password}' against hash...`);
  const isMatch = await bcrypt.compare(password, user.password);
  if (isMatch) {
    console.log('✅ bcrypt.compare() SUCCEEDED. Password is correct.');
  } else {
    console.error('❌ bcrypt.compare() FAILED. Password does not match hash.');
  }

  // 3. Test Login API
  const apiUrl = process.env.API_URL || 'http://localhost:5000';
  console.log(`Testing Login API at ${apiUrl}/api/auth/login...`);
  
  try {
    const response = await axios.post(`${apiUrl}/api/auth/login`, {
      email,
      password
    });
    console.log('✅ API Login SUCCEEDED.');
    console.log('   Status:', response.status);
    console.log('   Token received:', !!response.data.token);
  } catch (error: any) {
    console.error('❌ API Login FAILED.');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    } else {
      console.error('   Error:', error.message);
    }
  }
  
  console.log('--- DIAGNOSTIC END ---');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
