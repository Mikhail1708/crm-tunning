import { Router } from 'express';
import { authMiddleware, managerAccess } from '../middleware/auth.middleware';
import { createProductKit, deleteProductKit, getProductKitById, getProductKitByProductId, getProductKits, updateProductKit } from '../controllers/productKits.controller';
const router=Router(); router.use(authMiddleware as any);
router.get('/',getProductKits as any); router.get('/product/:productId',getProductKitByProductId as any); router.get('/:id',getProductKitById as any);
router.post('/',managerAccess as any,createProductKit as any); router.put('/:id',managerAccess as any,updateProductKit as any); router.delete('/:id',managerAccess as any,deleteProductKit as any);
export default router;
