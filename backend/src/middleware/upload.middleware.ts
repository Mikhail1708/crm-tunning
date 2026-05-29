// backend/src/middleware/upload.middleware.ts
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import crypto from 'crypto';

const uploadDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Генерация хеша для имени файла
function generateHash(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const hash = crypto.createHash('sha256');
  hash.update(`${originalName}-${timestamp}-${random}`);
  return hash.digest('hex').substring(0, 32);
}

// Временное хранилище
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const tempName = `temp_${Date.now()}_${Math.round(Math.random() * 1E9)}`;
    cb(null, tempName);
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Неподдерживаемый формат файла'), false);
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: fileFilter
});

// Middleware для обработки изображения
export const processUploadedImage = async (req: any, res: any, next: any) => {
  if (!req.file) {
    return next();
  }
  
  try {
    const tempPath = req.file.path;
    const originalName = req.file.originalname;
    
    console.log('Processing image:', tempPath);
    
    // Генерируем хешированное имя
    const hash = generateHash(originalName);
    const outputFilename = `${hash}.webp`;
    const outputPath = path.join(uploadDir, outputFilename);
    
    // Обрабатываем изображение
    const metadata = await sharp(tempPath).metadata();
    console.log('Original image size:', metadata.width, 'x', metadata.height);
    
    let sharpInstance = sharp(tempPath);
    
    // Уменьшаем если слишком большое
    if (metadata.width && metadata.width > 1200) {
      sharpInstance = sharpInstance.resize(1200, null, {
        withoutEnlargement: true,
        fit: 'inside'
      });
    }
    
    // Конвертируем в WebP с сжатием
    await sharpInstance
      .webp({
        quality: 80,
        effort: 6,
        lossless: false
      })
      .toFile(outputPath);
    
    // Получаем размер сжатого файла
    const stats = fs.statSync(outputPath);
    console.log('Processed image size:', stats.size, 'bytes');
    
    // Удаляем временный файл
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    
    // Обновляем информацию в req.file
    req.file.filename = outputFilename;
    req.file.path = outputPath;
    req.file.size = stats.size;
    
    console.log('Image processed successfully:', outputFilename);
    
    next();
  } catch (error) {
    console.error('Error processing image:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Ошибка обработки изображения' });
  }
};