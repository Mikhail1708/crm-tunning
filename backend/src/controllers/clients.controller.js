// backend/src/controllers/clients.controller.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Получить всех клиентов с фильтрацией
const getAllClients = async (req, res) => {
  try {
    const { search, sortBy, sortOrder, page = 1, limit = 20 } = req.query;
    
    let where = {};
    
    if (search) {
      where = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { carModel: { contains: search, mode: 'insensitive' } },
          { carNumber: { contains: search, mode: 'insensitive' } },
          { carVin: { contains: search, mode: 'insensitive' } },
        ]
      };
    }
    
    const clients = await prisma.client.findMany({
      where,
      orderBy: { [sortBy || 'createdAt']: sortOrder === 'asc' ? 'asc' : 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        _count: { select: { orders: true } }
      }
    });
    
    const total = await prisma.client.count({ where });
    
    res.json({ clients, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Error in getAllClients:', error);
    res.status(500).json({ error: error.message });
  }
};

// Получить клиента по ID
const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) },
      include: {
        orders: {
          orderBy: { saleDate: 'desc' },
          take: 10,
          include: {
            items: true
          }
        }
      }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    
    res.json(client);
  } catch (error) {
    console.error('Error in getClientById:', error);
    res.status(500).json({ error: error.message });
  }
};

// Создать клиента
const createClient = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      middleName,
      phone,
      email,
      birthDate,
      address,
      city,
      passport,
      driverLicense,
      carModel,
      carYear,
      carVin,
      carNumber,
      notes
    } = req.body;
    
    // Проверяем уникальность телефона
    const existingClient = await prisma.client.findUnique({
      where: { phone }
    });
    
    if (existingClient) {
      return res.status(400).json({ error: 'Клиент с таким телефоном уже существует' });
    }
    
    const client = await prisma.client.create({
      data: {
        firstName,
        lastName,
        middleName,
        phone,
        email,
        birthDate: birthDate ? new Date(birthDate) : null,
        address,
        city,
        passport,
        driverLicense,
        carModel,
        carYear: carYear ? parseInt(carYear) : null,
        carVin,
        carNumber,
        notes
      }
    });
    
    res.status(201).json(client);
  } catch (error) {
    console.error('Error in createClient:', error);
    res.status(500).json({ error: error.message });
  }
};

// Обновить клиента
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Если обновляется телефон, проверяем уникальность
    if (updateData.phone) {
      const existingClient = await prisma.client.findFirst({
        where: {
          phone: updateData.phone,
          NOT: { id: parseInt(id) }
        }
      });
      
      if (existingClient) {
        return res.status(400).json({ error: 'Клиент с таким телефоном уже существует' });
      }
    }
    
    const client = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        ...updateData,
        birthDate: updateData.birthDate ? new Date(updateData.birthDate) : null,
        carYear: updateData.carYear ? parseInt(updateData.carYear) : null
      }
    });
    
    res.json(client);
  } catch (error) {
    console.error('Error in updateClient:', error);
    res.status(500).json({ error: error.message });
  }
};

// Удалить клиента
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверяем, есть ли у клиента заказы
    const ordersCount = await prisma.saleDocument.count({
      where: { clientId: parseInt(id) }
    });
    
    if (ordersCount > 0) {
      return res.status(400).json({ 
        error: 'Нельзя удалить клиента, у которого есть заказы' 
      });
    }
    
    await prisma.client.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ message: 'Клиент удален' });
  } catch (error) {
    console.error('Error in deleteClient:', error);
    res.status(500).json({ error: error.message });
  }
};

// Поиск клиентов для автокомплита
const searchClients = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ clients: [] });
    }
    
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { carNumber: { contains: q, mode: 'insensitive' } },
        ]
      },
      take: 10,
      orderBy: [
        { totalOrders: 'desc' },
        { createdAt: 'desc' }
      ]
    });
    
    res.json({ clients });
  } catch (error) {
    console.error('Error in searchClients:', error);
    res.status(500).json({ error: error.message });
  }
};

// Получить статистику по клиентам
const getClientsStats = async (req, res) => {
  try {
    const totalClients = await prisma.client.count();
    
    const totalSpentResult = await prisma.client.aggregate({
      _sum: { totalSpent: true }
    });
    
    const topClients = await prisma.client.findMany({
      orderBy: { totalSpent: 'desc' },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        totalOrders: true,
        totalSpent: true
      }
    });
    
    const newClientsThisMonth = await prisma.client.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }
    });
    
    res.json({
      totalClients,
      totalSpent: totalSpentResult._sum.totalSpent || 0,
      topClients,
      newClientsThisMonth
    });
  } catch (error) {
    console.error('Error in getClientsStats:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  searchClients,
  getClientsStats
};