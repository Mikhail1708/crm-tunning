import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';

export const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_PIXELS = 40_000_000;

const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export class InvalidProductImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProductImageError';
  }
}

export interface ProcessedImage {
  data: Buffer;
  sourceMimeType: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  originalName: string;
  contentHash: string;
  sourceSize: number;
  optimized: boolean;
}

const createSharp = (buffer: Buffer) => sharp(buffer, {
  animated: false,
  failOn: 'error',
  limitInputPixels: MAX_PRODUCT_IMAGE_PIXELS,
  sequentialRead: true,
});

const safeOriginalName = (name: string): string => {
  const basename = path.basename(name || 'image').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (basename || 'image').slice(0, 255);
};

export async function processImageBuffer(
  input: Buffer,
  originalName: string,
): Promise<ProcessedImage> {
  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw new InvalidProductImageError('Файл изображения пуст');
  }
  if (input.length > MAX_PRODUCT_IMAGE_BYTES) {
    throw new InvalidProductImageError('Размер изображения превышает 10 МБ');
  }

  try {
    const metadata = await createSharp(input).metadata();
    const format = metadata.format || '';
    const mimeType = MIME_BY_FORMAT[format];

    if (!mimeType || !metadata.width || !metadata.height) {
      throw new InvalidProductImageError('Разрешены только JPEG, PNG и WebP изображения');
    }
    if ((metadata.pages || 1) > 1) {
      throw new InvalidProductImageError('Анимированные изображения не поддерживаются');
    }

    const candidates: Array<{ data: Buffer; mimeType: string }> = [
      { data: input, mimeType },
    ];

    // Every candidate is lossless. The original remains the fallback whenever
    // re-encoding does not reduce the payload.
    if (format === 'png') {
      candidates.push({
        data: await createSharp(input)
          .keepMetadata()
          .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
          .toBuffer(),
        mimeType: 'image/png',
      });
    }

    candidates.push({
      data: await createSharp(input)
        .keepMetadata()
        .webp({ lossless: true, effort: 6 })
        .toBuffer(),
      mimeType: 'image/webp',
    });

    const stored = candidates.reduce((smallest, candidate) => (
      candidate.data.length < smallest.data.length ? candidate : smallest
    ));
    const storedMetadata = await createSharp(stored.data).metadata();

    if (storedMetadata.width !== metadata.width || storedMetadata.height !== metadata.height) {
      throw new InvalidProductImageError('Не удалось сохранить размеры изображения');
    }

    return {
      data: stored.data,
      sourceMimeType: mimeType,
      mimeType: stored.mimeType,
      size: stored.data.length,
      width: metadata.width,
      height: metadata.height,
      originalName: safeOriginalName(originalName),
      contentHash: crypto.createHash('sha256').update(stored.data).digest('hex'),
      sourceSize: input.length,
      optimized: stored.data !== input,
    };
  } catch (error) {
    if (error instanceof InvalidProductImageError) throw error;
    throw new InvalidProductImageError('Файл повреждён или не является поддерживаемым изображением');
  }
}
