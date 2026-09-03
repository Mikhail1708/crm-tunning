// crm-project/backend/src/routes/public.routes.ts
import { Router } from 'express';
import { 
  getPublicProducts, 
  getPublicProductById,
  getPublicProductImage,
  getPublicCategories 
} from '../controllers/public.controller';
import { rateLimit } from 'express-rate-limit';

// Ограничение запросов для публичного API
const publicLimiter = rateLimit({
windowMs: 60 * 1000, // 1 минута
max: 500, // 🔥 ИЗМЕНИ С 100 НА 500 (или больше)
message: { error: 'Слишком много запросов, попробуйте позже' },
 standardHeaders: true,
legacyHeaders: false,
});

const router = Router();

router.use(publicLimiter);

// Публичные эндпоинты (без JWT)
router.get('/products', getPublicProducts);
router.get('/products/:productId/images/:imageId', getPublicProductImage);
router.get('/products/:id', getPublicProductById);
router.get('/categories', getPublicCategories);

export default router;
