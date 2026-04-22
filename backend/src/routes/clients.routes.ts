// backend/src/routes/clients.routes.ts
import { Router } from 'express';
import {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  searchClients,
  getClientsStats,
  updateClientDiscount
} from '../controllers/clients.controller';
import { authMiddleware, managerAccess } from '../middleware/auth.middleware';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware as any);

router.get('/', getAllClients as any);
router.get('/search', searchClients as any);
router.get('/stats', getClientsStats as any);
router.get('/stats/summary', getClientsStats as any);
router.get('/:id', getClientById as any);
router.post('/', managerAccess as any, createClient as any);
router.put('/:id', managerAccess as any, updateClient as any);
router.patch('/:id/discount', managerAccess as any, updateClientDiscount as any);
router.delete('/:id', managerAccess as any, deleteClient as any);

export default router;