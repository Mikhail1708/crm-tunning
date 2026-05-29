// backend/src/routes/products.routes.ts
import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  getPriceHistory,
  updateProductPrice,
  uploadProductImage,
  deleteProductImage,
  setMainProductImage,
  getProductImages
} from '../controllers/products.controller';
import { authMiddleware, managerAccess } from '../middleware/auth.middleware';
import { upload, processUploadedImage } from '../middleware/upload.middleware';

const router = Router();

router.use(authMiddleware as any);

router.get('/', getProducts as any);
router.get('/low-stock', getLowStockProducts as any);
router.get('/:id', getProductById as any);
router.get('/:id/price-history', getPriceHistory as any);
router.get('/:id/images', getProductImages as any);

router.post('/', managerAccess as any, createProduct as any);
router.put('/:id', managerAccess as any, updateProduct as any);
router.delete('/:id', managerAccess as any, deleteProduct as any);
router.put('/:id/price', managerAccess as any, updateProductPrice as any);

// ВАЖНО: добавляем processUploadedImage после upload
router.post('/:id/images', managerAccess as any, upload.single('image'), processUploadedImage, uploadProductImage as any);
router.delete('/:id/images/:imageId', managerAccess as any, deleteProductImage as any);
router.put('/:id/images/:imageId/main', managerAccess as any, setMainProductImage as any);

export default router;