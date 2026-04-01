// backend/src/routes/clients.routes.ts
import { Router } from 'express';
import {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  searchClients,
  getClientsStats
} from '../controllers/clients.controller';
import { authMiddleware, managerAccess } from '../middleware/auth.middleware';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

router.get('/', getAllClients);
router.get('/search', searchClients);
router.get('/stats', getClientsStats);  // Добавляем этот маршрут для совместимости
router.get('/stats/summary', getClientsStats);  // Оставляем для обратной совместимости
router.get('/:id', getClientById);
router.post('/', managerAccess, createClient);
router.put('/:id', managerAccess, updateClient);
router.delete('/:id', managerAccess, deleteClient);

export default router;