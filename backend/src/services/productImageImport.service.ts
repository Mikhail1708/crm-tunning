import fs from 'fs/promises';
import path from 'path';
import { processImageBuffer } from '../middleware/imageProcessor';
import { productImageBinaryPath } from './productImages.service';

export type ProductImageImportSummary = {
  imported: number;
  skipped: number;
  failed: number;
};

type LegacyImageRow = {
  id: number;
  productId: number;
  isMain: boolean;
  data: Buffer | null;
  filename: string | null;
};

type ProductImageImportStore = {
  productImage: {
    findMany: (args: unknown) => Promise<LegacyImageRow[]>;
    update: (args: unknown) => Promise<unknown>;
  };
  product: {
    update: (args: unknown) => Promise<unknown>;
  };
  $transaction?: (callback: (transaction: ProductImageImportStore) => Promise<void>) => Promise<void>;
};

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
    select: { id: true, productId: true, isMain: true, data: true, filename: true },
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
        const persist = async (transaction: ProductImageImportStore) => {
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
          if (row.isMain) {
            await transaction.product.update({
              where: { id: row.productId },
              data: { image_url: productImageBinaryPath(row.productId, row.id) },
            });
          }
        };
        if (store.$transaction) await store.$transaction(persist);
        else await persist(store);
      }
      summary.imported += 1;
    } catch {
      summary.failed += 1;
      report(`FAILED image ${row.id}: file is missing or invalid`);
    }
  }

  return summary;
}
