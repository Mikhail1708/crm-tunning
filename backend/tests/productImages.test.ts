import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { after, describe, it } from 'node:test';
import sharp from 'sharp';
import {
  InvalidProductImageError,
  processImageBuffer,
} from '../src/middleware/imageProcessor';
import { processUploadedImage } from '../src/middleware/upload.middleware';
import {
  absoluteProductImageUrl,
  buildProductImageHttpResponse,
  deleteProductImageRecord,
  productImageCreateData,
  productImageMetadataSelect,
  ProductImageNotFoundError,
  setMainProductImageRecord,
} from '../src/services/productImages.service';
import { importLegacyProductImages } from '../src/services/productImageImport.service';

const temporaryDirectories: string[] = [];

after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )));
});

const pixels = {
  create: {
    width: 128,
    height: 64,
    channels: 4 as const,
    background: { r: 18, g: 28, b: 38, alpha: 1 },
  },
};

const assertSamePixels = async (left: Buffer, right: Buffer) => {
  const a = await sharp(left).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(right).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(a.info.width, b.info.width);
  assert.equal(a.info.height, b.info.height);
  assert.deepEqual(a.data, b.data);
};

describe('product image processing and storage contract', () => {
  it('accepts JPEG, PNG and WebP without changing dimensions or decoded pixels', async () => {
    const fixtures = [
      await sharp(pixels).jpeg({ quality: 92 }).toBuffer(),
      await sharp(pixels).png({ compressionLevel: 0 }).toBuffer(),
      await sharp(pixels).webp({ lossless: true }).toBuffer(),
    ];

    for (const [index, source] of fixtures.entries()) {
      const result = await processImageBuffer(source, `fixture-${index}`);
      assert.equal(result.width, 128);
      assert.equal(result.height, 64);
      assert.ok(['image/jpeg', 'image/png', 'image/webp'].includes(result.mimeType));
      assert.ok(result.size <= source.length);
      await assertSamePixels(source, result.data);
    }
  });

  it('uses a smaller lossless representation only when it wins', async () => {
    const original = await sharp(pixels).png({ compressionLevel: 0 }).toBuffer();
    const stored = await processImageBuffer(original, 'large-source.png');
    assert.ok(stored.size < original.length);
    await assertSamePixels(original, stored.data);
    console.log(`TEST_IMAGE_SIZE original=${original.length} stored=${stored.size}`);
  });

  it('validates the declared MIME against the source before lossless conversion', async () => {
    const original = await sharp(pixels).png({ compressionLevel: 0 }).toBuffer();
    const response = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };
    const validRequest = {
      file: { buffer: original, originalname: 'fixture.png', mimetype: 'image/png' },
    } as any;
    let nextCalled = false;
    await processUploadedImage(validRequest, response as any, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(validRequest.processedImage.sourceMimeType, 'image/png');
    assert.equal(validRequest.processedImage.mimeType, 'image/webp');

    const mismatchedRequest = {
      file: { buffer: original, originalname: 'fixture.png', mimetype: 'image/webp' },
    } as any;
    nextCalled = false;
    await processUploadedImage(mismatchedRequest, response as any, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(response.statusCode, 400);
  });

  it('rejects malformed files and unsupported real formats', async () => {
    await assert.rejects(
      processImageBuffer(Buffer.from('not an image'), 'fake.png'),
      InvalidProductImageError,
    );
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
    await assert.rejects(processImageBuffer(svg, 'fake.png'), InvalidProductImageError);
  });

  it('builds binary DB create data without a filesystem path', async () => {
    const original = await sharp(pixels).png().toBuffer();
    const processed = await processImageBuffer(original, '../unsafe/product.png');
    const data = productImageCreateData(134, processed, 0);

    assert.ok(Buffer.isBuffer(data.data));
    assert.equal(data.productId, 134);
    assert.equal(data.originalName, 'product.png');
    assert.equal(data.isMain, true);
    assert.equal(data.url, null);
    assert.equal(data.filename, null);
    assert.equal('path' in data, false);
  });

  it('keeps binary data out of metadata queries and preserves absolute website URLs', () => {
    assert.equal('data' in productImageMetadataSelect, false);
    const previous = process.env.PUBLIC_API_URL;
    process.env.PUBLIC_API_URL = 'https://crm.example.test';
    try {
      const url = absoluteProductImageUrl({} as any, 134, 7);
      assert.equal(url, 'https://crm.example.test/api/public/products/134/images/7');
    } finally {
      if (previous === undefined) delete process.env.PUBLIC_API_URL;
      else process.env.PUBLIC_API_URL = previous;
    }
  });

  it('uses the CRM request origin for local image URLs instead of a frontend BASE_URL', () => {
    const previousPublic = process.env.PUBLIC_API_URL;
    const previousBase = process.env.BASE_URL;
    const previousEnvironment = process.env.NODE_ENV;
    delete process.env.PUBLIC_API_URL;
    process.env.BASE_URL = 'http://localhost:5173';
    process.env.NODE_ENV = 'development';
    try {
      const req = { protocol: 'http', get: () => 'localhost:5000' } as any;
      assert.equal(
        absoluteProductImageUrl(req, 134, 7),
        'http://localhost:5000/api/public/products/134/images/7',
      );
    } finally {
      if (previousPublic === undefined) delete process.env.PUBLIC_API_URL;
      else process.env.PUBLIC_API_URL = previousPublic;
      if (previousBase === undefined) delete process.env.BASE_URL;
      else process.env.BASE_URL = previousBase;
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
    }
  });

  it('returns a binary response contract with the stored content type and cache headers', () => {
    const body = Buffer.from([1, 2, 3, 4]);
    const response = buildProductImageHttpResponse({
      data: body,
      mimeType: 'image/png',
      contentHash: 'abc123',
      updatedAt: new Date('2026-09-03T00:00:00.000Z'),
    });

    assert.equal(response?.status, 200);
    assert.equal(response?.headers['Content-Type'], 'image/png');
    assert.equal(response?.headers['Content-Length'], '4');
    assert.equal(response?.headers.ETag, '"abc123"');
    assert.deepEqual(response?.body, body);
  });

  it('deletes only the DB row and preserves main-image semantics for legacy rows', async () => {
    const rows = [
      {
        id: 1, productId: 134, mimeType: 'image/webp', size: 10, width: 2, height: 2,
        originalName: 'db.webp', isMain: true, sortOrder: 0, createdAt: new Date(),
        updatedAt: new Date(), url: null, filename: null,
      },
      {
        id: 2, productId: 134, mimeType: null, size: 12, width: null, height: null,
        originalName: null, isMain: false, sortOrder: 1, createdAt: new Date(),
        updatedAt: new Date(), url: '/uploads/products/legacy.webp', filename: 'legacy.webp',
      },
    ];
    let productImageUrl: string | null = null;
    const store = {
      $queryRaw: async () => [{ id: 134 }],
      productImage: {
        findMany: async () => rows,
        updateMany: async ({ where, data }: any) => {
          rows.filter((row) => where.id?.not === undefined || row.id !== where.id.not)
            .forEach((row) => Object.assign(row, data));
          return { count: rows.length };
        },
        findFirst: async ({ where }: any) => rows.find((row) => (
          row.productId === where.productId && (where.id === undefined || row.id === where.id)
        )) || null,
        delete: async ({ where }: any) => rows.splice(rows.findIndex((row) => row.id === where.id), 1)[0],
        update: async ({ where, data }: any) => Object.assign(rows.find((row) => row.id === where.id)!, data),
      },
      product: {
        update: async ({ data }: any) => { productImageUrl = data.image_url; },
      },
    };

    await deleteProductImageRecord(store as any, 134, 1);
    assert.deepEqual(rows.map((row) => row.id), [2]);
    assert.equal(rows[0].isMain, true);
    assert.equal(productImageUrl, '/uploads/products/legacy.webp');
  });

  it('does not allow setting an image from another product as main', async () => {
    const store = {
      $queryRaw: async () => [{ id: 134 }],
      productImage: {
        findFirst: async () => null,
        updateMany: async () => assert.fail('must not update images'),
        update: async () => assert.fail('must not update an image'),
      },
      product: { update: async () => assert.fail('must not update a product') },
    };
    await assert.rejects(
      setMainProductImageRecord(store as any, 134, 999),
      ProductImageNotFoundError,
    );
  });

  it('imports a legacy row once, keeps the original file and skips it on repeat', async () => {
    const uploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-product-images-'));
    temporaryDirectories.push(uploadRoot);
    const filename = 'legacy.webp';
    const source = await sharp(pixels).webp({ lossless: true }).toBuffer();
    await fs.writeFile(path.join(uploadRoot, filename), source);

    const row: {
      id: number;
      productId: number;
      isMain: boolean;
      data: Buffer | null;
      filename: string | null;
    } = {
      id: 10,
      productId: 134,
      isMain: true,
      data: null,
      filename,
    };
    let updates = 0;
    const store = {
      $queryRaw: async () => [{ id: 134 }],
      $transaction: async (callback: (transaction: any) => Promise<any>) => callback(store),
      productImage: {
        findMany: async () => [row],
        findFirst: async () => row,
        updateMany: async () => ({ count: 0 }),
        update: async (args: any) => {
          if (args.data.data) updates += 1;
          Object.assign(row, args.data);
          return row;
        },
      },
      product: {
        update: async () => undefined,
      },
    };

    const dryRun = await importLegacyProductImages({ store: store as any, uploadRoot, apply: false });
    assert.deepEqual(dryRun, { imported: 1, skipped: 0, failed: 0 });
    assert.equal(updates, 0);

    const first = await importLegacyProductImages({ store: store as any, uploadRoot, apply: true });
    const repeated = await importLegacyProductImages({ store: store as any, uploadRoot, apply: true });
    assert.deepEqual(first, { imported: 1, skipped: 0, failed: 0 });
    assert.deepEqual(repeated, { imported: 0, skipped: 1, failed: 0 });
    assert.equal(updates, 1);
    assert.ok((await fs.stat(path.join(uploadRoot, filename))).isFile());
  });

  for (const concurrentChange of ['main-changed', 'deleted', 'moved', 'already-imported', 'filename-changed'] as const) {
    it(`legacy import rechecks current state after lock: ${concurrentChange}`, async () => {
      const uploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-product-images-'));
      temporaryDirectories.push(uploadRoot);
      const filename = 'legacy.webp';
      await fs.writeFile(path.join(uploadRoot, filename), await sharp(pixels).webp({ lossless: true }).toBuffer());
      const row: any = {
        id: 10, productId: 134, isMain: true, data: null, filename,
        mimeType: null, url: '/uploads/products/legacy.webp', sortOrder: 0,
      };
      const other: any = {
        id: 11, productId: 134, isMain: false, data: Buffer.from('existing'), filename: null,
        mimeType: 'image/webp', url: null, sortOrder: 1,
      };
      let rows = [row, other];
      let locked = false;
      let writes = 0;
      let pointer = '/api/public/products/134/images/11';
      const tx: any = {
        $queryRaw: async () => { locked = true; return [{ id: 134 }]; },
        productImage: {
          findFirst: async ({ where }: any) => {
            assert.ok(locked);
            return rows.find((image) => image.id === where.id && image.productId === where.productId) || null;
          },
          findMany: async () => { assert.ok(locked); return rows; },
          update: async ({ where, data }: any) => {
            assert.ok(locked); writes += 1;
            return Object.assign(rows.find((image) => image.id === where.id)!, data);
          },
          updateMany: async () => { assert.ok(locked); return { count: 0 }; },
        },
        product: { update: async ({ data }: any) => { assert.ok(locked); pointer = data.image_url; } },
      };
      const store: any = {
        productImage: { findMany: async () => [{ ...row }] },
        $transaction: async (callback: (transaction: any) => Promise<unknown>, options: any) => {
          assert.equal(options.isolationLevel, 'ReadCommitted');
          if (concurrentChange === 'main-changed') { row.isMain = false; other.isMain = true; }
          if (concurrentChange === 'deleted') rows = [other];
          if (concurrentChange === 'moved') row.productId = 999;
          if (concurrentChange === 'already-imported') row.data = Buffer.from('concurrently imported');
          if (concurrentChange === 'filename-changed') row.filename = 'replacement.webp';
          return callback(tx);
        },
      };
      const summary = await importLegacyProductImages({ store, uploadRoot, apply: true });
      assert.ok(locked);
      const invalidated = ['filename-changed', 'deleted', 'moved'].includes(concurrentChange);
      assert.equal(summary.failed, invalidated ? 1 : 0);
      if (concurrentChange === 'main-changed') {
        assert.equal(summary.imported, 1);
        assert.equal(row.isMain, false);
        assert.equal(other.isMain, true);
        assert.equal(pointer, '/api/public/products/134/images/11');
      } else if (invalidated) {
        assert.equal(summary.imported, 0);
        assert.equal(writes, 0);
      } else {
        assert.equal(summary.skipped, 1);
        assert.equal(writes, 0);
      }
    });
  }
});
