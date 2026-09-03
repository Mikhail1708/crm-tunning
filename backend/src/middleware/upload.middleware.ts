import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import {
  InvalidProductImageError,
  MAX_PRODUCT_IMAGE_BYTES,
  ProcessedImage,
  processImageBuffer,
} from './imageProcessor';

const allowedClientMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PRODUCT_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedClientMimeTypes.has(file.mimetype)) {
      callback(new InvalidProductImageError('Разрешены только JPEG, PNG и WebP изображения'));
      return;
    }
    callback(null, true);
  },
});

export type RequestWithProcessedImage = Request & {
  processedImage?: ProcessedImage;
};

export const uploadProductImageFile = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('image')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ message: 'Размер изображения превышает 10 МБ' });
      return;
    }
    if (error instanceof InvalidProductImageError) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(400).json({ message: 'Не удалось загрузить изображение' });
  });
};

export const processUploadedImage = async (
  req: RequestWithProcessedImage,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ message: 'Файл изображения не загружен' });
    return;
  }

  try {
    const processedImage = await processImageBuffer(req.file.buffer, req.file.originalname);
    if (processedImage.sourceMimeType !== req.file.mimetype) {
      res.status(400).json({ message: 'Тип файла не соответствует содержимому изображения' });
      return;
    }
    req.processedImage = processedImage;
    next();
  } catch (error) {
    if (error instanceof InvalidProductImageError) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Не удалось обработать изображение' });
  }
};
