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
  updateClientDiscount  // 🆕 новый контроллер
} from '../controllers/clients.controller';
import { authMiddleware, managerAccess } from '../middleware/auth.middleware';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

router.get('/', getAllClients);
router.get('/search', searchClients);
router.get('/stats', getClientsStats);
router.get('/stats/summary', getClientsStats);
router.get('/:id', getClientById);
router.post('/', managerAccess, createClient);
router.put('/:id', managerAccess, updateClient);
router.patch('/:id/discount', managerAccess, updateClientDiscount);  // 🆕 маршрут для скидки
router.delete('/:id', managerAccess, deleteClient);

export default router;