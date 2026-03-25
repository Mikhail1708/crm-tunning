// backend/src/routes/clients.routes.js
const express = require('express');
const router = express.Router();
const clientsController = require('../controllers/clients.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Маршруты
router.get('/', clientsController.getAllClients);
router.get('/search', clientsController.searchClients);
router.get('/stats', clientsController.getClientsStats);
router.get('/:id', clientsController.getClientById);
router.post('/', clientsController.createClient);
router.put('/:id', clientsController.updateClient);
router.delete('/:id', clientsController.deleteClient);

module.exports = router;