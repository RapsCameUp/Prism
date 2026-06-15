import { config } from 'dotenv';
config();

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.remediation.deleteMany();
  await prisma.investigation.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.repository.deleteMany();
  await prisma.user.deleteMany();

  // 1. Seed admin user
  const passwordHash = await bcrypt.hash('password123', 10);
  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@prism.ai',
      passwordHash,
      role: 'admin',
    },
  });
  console.log(`✅ Created admin user: ${admin.email}`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('📧 Login: admin@prism.ai / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
