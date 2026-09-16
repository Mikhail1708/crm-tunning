import fs from 'fs/promises';
import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import { processImageBuffer } from '../middleware/imageProcessor';
import { lockProductForImages, ProductImageNotFoundError, syncProductMainImage } from './productImages.service';

export type ProductImageImportSummary = {
  imported: number;
  skipped: number;
  failed: number;
};

type ProductImageImportStore = Pick<PrismaClient, 'productImage' | '$transaction'>;

const resolveLegacyFile = (uploadRoot: string, filename: string): string | null => {
  if (filename.includes('/') || filename.includes('\\') || filename !== path.basename(filename)) return null;
  const root = path.resolve(uploadRoot);
  const candidate = path.resolve(root, filename);
  const rootPrefix = `${root}${path.sep}`.toLocaleLowerCase('en-US');
  return candidate.toLocaleLowerCase('en-US').startsWith(rootPrefix) ? candidate : null;
};

export async function importLegacyProductImages(options: {
  store: ProductImageImportStore;
  uploadRoot: string;
  apply: boolean;
  report?: (message: string) => void;
}): Promise<ProductImageImportSummary> {
  const { store, uploadRoot, apply, report = () => undefined } = options;
  const summary: ProductImageImportSummary = { imported: 0, skipped: 0, failed: 0 };
  const rows = await store.productImage.findMany({
    select: { id: true, productId: true, data: true, filename: true },
    orderBy: { id: 'asc' },
  });

  for (const row of rows) {
    if (row.data) {
      summary.skipped += 1;
      continue;
    }
    if (!row.filename) {
      summary.failed += 1;
      report(`FAILED image ${row.id}: legacy filename is missing`);
      continue;
    }

    const filePath = resolveLegacyFile(uploadRoot, row.filename);
    if (!filePath) {
      summary.failed += 1;
      report(`FAILED image ${row.id}: unsafe legacy filename`);
      continue;
    }

    try {
      const original = await fs.readFile(filePath);
      const processed = await processImageBuffer(original, row.filename);
      if (apply) {
        // File IO/decoding is complete before acquiring the parent lock.
        const imported = await store.$transaction(async transaction => {
          if (!(await lockProductForImages(transaction, row.productId))) {
            throw new ProductImageNotFoundError();
          }
          const current = await transaction.productImage.findFirst({
            where: { id: row.id, productId: row.productId },
            select: { id: true, data: true, filename: true },
          });
          if (!current) throw new ProductImageNotFoundError();
          if (current.data) return false; // Another importer completed while we decoded.
          if (current.filename !== row.filename) {
            throw new Error('Legacy image changed during processing');
          }
          await transaction.productImage.update({
            where: { id: row.id },
            data: {
              data: processed.data,
              mimeType: processed.mimeType,
              size: processed.size,
              width: processed.width,
              height: processed.height,
              originalName: processed.originalName,
              contentHash: processed.contentHash,
              url: null,
              filename: null,
            },
          });
          await syncProductMainImage(transaction, row.productId);
          return true;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
        if (!imported) {
          summary.skipped += 1;
          continue;
        }
      }
      summary.imported += 1;
    } catch {
      summary.failed += 1;
      report(`FAILED image ${row.id}: file is missing or invalid`);
    }
  }

  return summary;
}
