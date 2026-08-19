import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processImage } from './imageProcessor';

const UPLOAD_DIR = path.join(__dirname, '../../uploads/products');

// Создаем папку если нет
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Настройка multer для временного хранения
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Неверный формат файла. Разрешены: jpeg, png, gif, webp'));
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: fileFilter
});

// Middleware для обработки изображения после загрузки
export const processUploadedImage = async (req: any, res: any, next: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }

    console.log('Processing image:', req.file.originalname);

    // Обрабатываем изображение (конвертируем в webp)
    const processed = await processImage(
      req.file.path,
      UPLOAD_DIR,
      req.file.originalname
    );

    console.log('Image processed:', processed.filename);

    // Удаляем оригинальный файл
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Подменяем файл на обработанный
    req.file.filename = processed.filename;
    req.file.path = processed.path;
    req.file.size = processed.size;

    next();
  } catch (error) {
    console.error('Error processing image:', error);
    // Если ошибка, удаляем оригинальный файл
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ 
      message: 'Ошибка обработки изображения',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};