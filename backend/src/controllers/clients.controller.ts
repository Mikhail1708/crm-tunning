// backend/src/controllers/clients.controller.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { RequestWithUser, CreateClientDTO } from '../types';

const prisma = new PrismaClient();

interface GetClientsQuery {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: string;
  limit?: string;
}

/**
 * GET /api/clients
 * Получить всех клиентов с фильтрацией
 */
export const getAllClients = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { search, sortBy = 'createdAt', sortOrder = 'desc', page = '1', limit = '20' } = req.query as GetClientsQuery;
    
    let where: any = {};
    
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
      orderBy: { [sortBy]: sortOrder },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      include: {
        _count: { select: { orders: true } }
      }
    });
    
    const total = await prisma.client.count({ where });
    
    res.json({
      clients,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error in getAllClients:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка получения клиентов' });
  }
};

/**
 * GET /api/clients/:id
 * Получить клиента по ID
 */
export const getClientById = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const clientId = parseInt(id);
    
    if (isNaN(clientId)) {
      res.status(400).json({ error: 'Неверный ID клиента' });
      return;
    }
    
    const client = await prisma.client.findUnique({
      where: { id: clientId },
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
      res.status(404).json({ error: 'Клиент не найден' });
      return;
    }
    
    res.json(client);
  } catch (error) {
    console.error('Error in getClientById:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка получения клиента' });
  }
};

/**
 * POST /api/clients
 * Создать клиента
 */
export const createClient = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const data: CreateClientDTO = req.body;
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
    } = data;
    
    // Проверяем обязательное поле
    if (!firstName || !phone) {
      res.status(400).json({ error: 'Имя и телефон обязательны для заполнения' });
      return;
    }
    
    // Проверяем уникальность телефона
    const existingClient = await prisma.client.findUnique({
      where: { phone }
    });
    
    if (existingClient) {
      res.status(400).json({ error: 'Клиент с таким телефоном уже существует' });
      return;
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
        carYear: carYear ? parseInt(carYear as any) : null,
        carVin,
        carNumber,
        notes
      }
    });
    
    res.status(201).json(client);
  } catch (error) {
    console.error('Error in createClient:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка создания клиента' });
  }
};

/**
 * PUT /api/clients/:id
 * Обновить клиента
 */
export const updateClient = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const clientId = parseInt(id);
    
    if (isNaN(clientId)) {
      res.status(400).json({ error: 'Неверный ID клиента' });
      return;
    }
    
    const updateData = req.body;
    
    // Если обновляется телефон, проверяем уникальность
    if (updateData.phone) {
      const existingClient = await prisma.client.findFirst({
        where: {
          phone: updateData.phone,
          NOT: { id: clientId }
        }
      });
      
      if (existingClient) {
        res.status(400).json({ error: 'Клиент с таким телефоном уже существует' });
        return;
      }
    }
    
    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...updateData,
        birthDate: updateData.birthDate ? new Date(updateData.birthDate) : undefined,
        carYear: updateData.carYear ? parseInt(updateData.carYear) : undefined
      }
    });
    
    res.json(client);
  } catch (error) {
    console.error('Error in updateClient:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка обновления клиента' });
  }
};

/**
 * DELETE /api/clients/:id
 * Удалить клиента
 */
export const deleteClient = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const clientId = parseInt(id);
    
    if (isNaN(clientId)) {
      res.status(400).json({ error: 'Неверный ID клиента' });
      return;
    }
    
    // Проверяем, есть ли у клиента заказы
    const ordersCount = await prisma.saleDocument.count({
      where: { clientId: clientId }
    });
    
    if (ordersCount > 0) {
      res.status(400).json({
        error: 'Нельзя удалить клиента, у которого есть заказы'
      });
      return;
    }
    
    await prisma.client.delete({
      where: { id: clientId }
    });
    
    res.json({ message: 'Клиент удален' });
  } catch (error) {
    console.error('Error in deleteClient:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка удаления клиента' });
  }
};

/**
 * GET /api/clients/search
 * Поиск клиентов для автокомплита
 */
export const searchClients = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      res.json({ clients: [] });
      return;
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
    res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка поиска клиентов' });
  }
};

/**
 * GET /api/clients/stats/summary
 * Получить статистику по клиентам
 */
export const getClientsStats = async (req: RequestWithUser, res: Response): Promise<void> => {
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
    res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка получения статистики' });
  }
};