import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function fixSequences() {
  try {
    console.log('\n🔄 Автоматическая синхронизация последовательностей БД...');
    
    // Получаем все таблицы с колонкой id
    const result = await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
          r RECORD;
          fixed_count INT := 0;
      BEGIN
          FOR r IN (
              SELECT tablename 
              FROM pg_tables 
              WHERE schemaname = 'public' 
              AND tablename NOT LIKE '_prisma%'
              AND tablename IN ('User', 'Product', 'Client', 'Category', 'Sale', 'SaleDocument', 'SaleDocumentItem', 'Expense', 'ProductCategory', 'ProductCharacteristic', 'CategoryField')
          ) LOOP
              BEGIN
                  EXECUTE format('
                      SELECT setval(%L, 
                          COALESCE((SELECT MAX(id) FROM %I), 1), 
                          false
                      )', 
                      r.tablename || '_id_seq', 
                      r.tablename
                  );
                  RAISE NOTICE '   ✅ % -> синхронизирована', r.tablename;
                  fixed_count := fixed_count + 1;
              EXCEPTION WHEN OTHERS THEN
                  RAISE NOTICE '   ⚠️ % -> пропущена (%)', r.tablename, SQLERRM;
              END;
          END LOOP;
          RAISE NOTICE '✅ Синхронизировано последовательностей: %', fixed_count;
      END $$;
    `);
    
    console.log('✅ Последовательности синхронизированы\n');
    return true;
  } catch (error) {
    console.warn('⚠️ Не удалось синхронизировать последовательности:', error);
    return false;
  }
}

// Автоматический экспорт для использования при старте
export async function initDatabase() {
  await fixSequences();
}