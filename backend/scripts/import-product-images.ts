import path from 'path';
import { PrismaClient } from '@prisma/client';
import { importLegacyProductImages } from '../src/services/productImageImport.service';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const uploadRoot = path.resolve(__dirname, '../uploads/products');
  console.log(`Product image import mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Legacy source: ${uploadRoot}`);

  const summary = await importLegacyProductImages({
    store: prisma,
    uploadRoot,
    apply,
    report: console.warn,
  });

  console.log(`imported=${summary.imported} skipped=${summary.skipped} failed=${summary.failed}`);
  if (summary.failed > 0) process.exitCode = 1;
}

main()
  .catch(() => {
    console.error('Product image import failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
