import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: passwordHash,
    },
  });
  
  console.log('Admin user ensured:', admin.username);

  const house = await prisma.house.upsert({
    where: { id: 'default-house-1' },
    update: {},
    create: {
      id: 'default-house-1',
      name: 'Alpha Home',
    },
  });
  
  console.log('Default house ensured:', house.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
