import { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { ProcessedImage } from '../middleware/imageProcessor';

export const productImageMetadataSelect = {
  id: true,
  productId: true,
  mimeType: true,
  size: true,
  width: true,
  height: true,
  originalName: true,
  isMain: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  url: true,
  filename: true,
} as const;

type ProductImageMetadata = {
  id: number;
  productId: number;
  mimeType: string | null;
  size: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
  isMain: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  url: string | null;
  filename: string | null;
};

const configuredBaseUrl = (): string | null => {
  const value = process.env.PUBLIC_API_URL
    || (process.env.NODE_ENV === 'production' ? process.env.BASE_URL : undefined);
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
};

export const requestBaseUrl = (req: Request): string => {
  const configured = configuredBaseUrl();
  if (configured) return configured;
  const host = req.get('host');
  if (!host) throw new Error('Request host is unavailable');
  const protocol = req.protocol === 'https' ? 'https' : 'http';
  return new URL(`${protocol}://${host}`).origin;
};

export const productImageBinaryPath = (productId: number, imageId: number): string => (
  `/api/public/products/${productId}/images/${imageId}`
);

export const absoluteProductImageUrl = (
  req: Request,
  productId: number,
  imageId: number,
): string => new URL(productImageBinaryPath(productId, imageId), requestBaseUrl(req)).toString();

export const absolutePublicUrl = (req: Request, value: string): string => {
  try {
    return new URL(value).toString();
  } catch {
    return new URL(value, requestBaseUrl(req)).toString();
  }
};

export const productImageUrl = (req: Request, image: ProductImageMetadata): string => {
  if (image.mimeType) return absoluteProductImageUrl(req, image.productId, image.id);
  if (image.url) return absolutePublicUrl(req, image.url);
  return absoluteProductImageUrl(req, image.productId, image.id);
};

export const productImageMetadataDto = (req: Request, image: ProductImageMetadata) => ({
  id: image.id,
  productId: image.productId,
  url: productImageUrl(req, image),
  filename: image.originalName || image.filename || 'image',
  originalName: image.originalName || image.filename || 'image',
  mimeType: image.mimeType,
  size: image.size,
  width: image.width,
  height: image.height,
  isMain: image.isMain,
  sortOrder: image.sortOrder,
  createdAt: image.createdAt,
  updatedAt: image.updatedAt,
});

export const productImageCreateData = (
  productId: number,
  image: ProcessedImage,
  position: number,
) => ({
  productId,
  data: image.data,
  mimeType: image.mimeType,
  size: image.size,
  width: image.width,
  height: image.height,
  originalName: image.originalName,
  contentHash: image.contentHash,
  url: null,
  filename: null,
  isMain: position === 0,
  sortOrder: position,
});

type StoredProductImage = {
  data: Buffer | Uint8Array | null;
  mimeType: string | null;
  contentHash: string | null;
  updatedAt: Date;
};

const safeStoredMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const buildProductImageHttpResponse = (
  image: StoredProductImage | null,
  ifNoneMatch?: string,
) => {
  if (!image?.data || !image.mimeType || !safeStoredMimeTypes.has(image.mimeType)) return null;
  const etag = image.contentHash ? `"${image.contentHash}"` : undefined;
  if (etag && ifNoneMatch === etag) return { status: 304 as const, headers: {}, body: null };

  const body = Buffer.from(image.data);
  return {
    status: 200 as const,
    headers: {
      'Content-Type': image.mimeType,
      'Content-Length': String(body.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Last-Modified': image.updatedAt.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
      ...(etag ? { ETag: etag } : {}),
    },
    body,
  };
};

export class ProductImageNotFoundError extends Error {
  constructor() {
    super('Фото не найдено');
    this.name = 'ProductImageNotFoundError';
  }
}

const persistedMainImageUrl = (image: ProductImageMetadata): string | null => (
  image.mimeType ? productImageBinaryPath(image.productId, image.id) : image.url
);

// Call only inside the interactive transaction used for the following writes.
// Lock the parent first: image-row locks cannot protect an empty image set.
export const lockProductForImages = async (
  transaction: Prisma.TransactionClient,
  productId: number,
): Promise<boolean> => {
  const rows = await transaction.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE
  `;
  return rows.length === 1;
};

export class ProductImageUploadError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ProductImageUploadError';
  }
}

// Requires the parent lock. Keep the existing main unless explicitly replaced;
// repair absent/duplicate main flags deterministically without removing images.
export const syncProductMainImage = async (
  transaction: Prisma.TransactionClient,
  productId: number,
  preferredImageId?: number,
): Promise<number | null> => {
  const images = await transaction.productImage.findMany({
    where: { productId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: productImageMetadataSelect,
  });
  const main = images.find(image => image.id === preferredImageId)
    || images.find(image => image.isMain) || images[0];
  if (main) {
    await transaction.productImage.updateMany({
      where: { productId, isMain: true, id: { not: main.id } },
      data: { isMain: false },
    });
    if (!main.isMain) {
      await transaction.productImage.update({ where: { id: main.id }, data: { isMain: true } });
    }
  }
  await transaction.product.update({
    where: { id: productId },
    data: { image_url: main ? persistedMainImageUrl(main) : null },
  });
  return main?.id ?? null;
};

export const createProductImageRecord = async (
  transaction: Prisma.TransactionClient,
  productId: number,
  processedImage: ProcessedImage,
): Promise<ProductImageMetadata> => {
  if (!(await lockProductForImages(transaction, productId))) {
    throw new ProductImageUploadError(404, 'Товар не найден');
  }
  const count = await transaction.productImage.count({ where: { productId } });
  if (count >= 5) throw new ProductImageUploadError(400, 'Максимум 5 фото на товар');
  const image = await transaction.productImage.create({
    data: productImageCreateData(productId, processedImage, count),
    select: productImageMetadataSelect,
  });
  const mainId = await syncProductMainImage(transaction, productId);
  return { ...image, isMain: image.id === mainId };
};

export const deleteProductImageRecord = async (
  store: Prisma.TransactionClient,
  productId: number,
  imageId: number,
): Promise<void> => {
  if (!(await lockProductForImages(store, productId))) throw new ProductImageNotFoundError();
  const image = await store.productImage.findFirst({
    where: { id: imageId, productId },
    select: productImageMetadataSelect,
  });
  if (!image) throw new ProductImageNotFoundError();

  await store.productImage.delete({ where: { id: imageId }, select: { id: true } });
  const nextImage = image.isMain ? await store.productImage.findFirst({
    where: { productId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: productImageMetadataSelect,
  }) : null;
  await syncProductMainImage(store, productId, nextImage?.id);
};

export const setMainProductImageRecord = async (
  store: Prisma.TransactionClient,
  productId: number,
  imageId: number,
): Promise<ProductImageMetadata> => {
  if (!(await lockProductForImages(store, productId))) throw new ProductImageNotFoundError();
  const target = await store.productImage.findFirst({
    where: { id: imageId, productId },
    select: productImageMetadataSelect,
  });
  if (!target) throw new ProductImageNotFoundError();

  await store.productImage.updateMany({ where: { productId }, data: { isMain: false } });
  const image = await store.productImage.update({
    where: { id: imageId },
    data: { isMain: true },
    select: productImageMetadataSelect,
  });
  await store.product.update({
    where: { id: productId },
    data: { image_url: persistedMainImageUrl(image) },
  });
  return image;
};
