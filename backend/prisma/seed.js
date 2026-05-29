// backend/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Начинаем заполнение базы данных...');


  const manager1Password = await bcrypt.hash('1605', 10);
  const manager2Password = await bcrypt.hash('182204', 10);



  // Создаем менеджера 1
  const manager1 = await prisma.user.upsert({
    where: { email: 'gurin@crm.ru' },
    update: {},
    create: {
      email: 'gurin@crm.ru',
      password: manager1Password,
      name: 'Александр Гурин',
      role: 'manager'
    }
  });
  console.log(`✅ Создан менеджер: ${manager1.email} (пароль: 1605)`);

  // Создаем менеджера 2
  const manager2 = await prisma.user.upsert({
    where: { email: 'batvenko@crm.ru' },
    update: {},
    create: {
      email: 'batvenko@crm.ru',
      password: manager2Password,
      name: 'Николай Батвенко',
      role: 'manager'
    }
  });
  console.log(`✅ Создан менеджер: ${manager2.email} (пароль: 182204)`);

  console.log('\n📋 Готово! Пользователи созданы:');
  console.log('👑 Администратор: admin@crm.ru / admin123');
  console.log('👤 Менеджер 1: gurin@crm.ru / 1605');
  console.log('👤 Менеджер 2: batvenko@crm.ru / 182204');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });