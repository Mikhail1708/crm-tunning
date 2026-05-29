import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Начало seeding...\n');

  // Хешируем пароли
  const adminPassword = await bcrypt.hash('mikhail52gr@gmail.comMikhail52Gr@170881', 10);
  const gurinPassword = await bcrypt.hash('1605', 10);
  const batvenkoPassword = await bcrypt.hash('182204', 10);

  // Создаём админа
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.ru' },
    update: {},
    create: {
      email: 'admin@crm.ru',
      password: adminPassword,
      name: 'Администратор',
      role: 'admin'
    }
  });
  console.log('✅ Админ:', admin.email, '| роль:', admin.role);

  // Создаём менеджера Гурина
  const gurin = await prisma.user.upsert({
    where: { email: 'gurin@crm.ru' },
    update: {},
    create: {
      email: 'gurin@crm.ru',
      password: gurinPassword,
      name: 'Гурин',
      role: 'manager'
    }
  });
  console.log('✅ Менеджер:', gurin.email, '| роль:', gurin.role);

  // Создаём менеджера Батвенко
  const batvenko = await prisma.user.upsert({
    where: { email: 'batvenko@crm.ru' },
    update: {},
    create: {
      email: 'batvenko@crm.ru',
      password: batvenkoPassword,
      name: 'Батвенко',
      role: 'manager'
    }
  });
  console.log('✅ Менеджер:', batvenko.email, '| роль:', batvenko.role);

  console.log('\n🌱 Seeding завершён!');
  console.log('📝 Тестовые данные для входа:');
  console.log('   admin@crm.ru / admin123');
  console.log('   gurin@crm.ru / 1605');
  console.log('   batvenko@crm.ru / 182204');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });