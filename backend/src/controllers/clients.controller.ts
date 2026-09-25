// crm-project/backend/src/controllers/clients.controller.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { RequestWithUser, CreateClientDTO, UpdateClientDiscountDTO } from '../types';
import auditService from '../services/audit.service';
import { parsePagination } from '../utils/pagination';
import { paidSaleWhere } from '../utils/saleFinancialEligibility';
import { clientsRankedBySpending, withClientFinancialTotals } from '../services/clientFinancials.service';

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
    
    const pagination = parsePagination(page, limit, 20, 1000);
    const allowedSortFields = ['createdAt', 'updatedAt', 'firstName', 'lastName', 'totalOrders', 'totalSpent', 'phone', 'city', 'discountPercent', 'id'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const direction: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    let where: any = {};
    
    if (search) {
      where = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { middleName: { contains: search, mode: 'insensitive' } }, // ✅
          { phone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { carModel: { contains: search, mode: 'insensitive' } },
          { carNumber: { contains: search, mode: 'insensitive' } },
          { carVin: { contains: search, mode: 'insensitive' } },
        ]
      };
    }
    
    const ranked = sortField === 'totalSpent'
      ? await clientsRankedBySpending(prisma, { search, direction, limit: pagination.limit, skip: pagination.skip }) : null;
    const pageClients = await prisma.client.findMany({
      where: ranked ? { id: { in: ranked.map(row => row.id) } } : where,
      orderBy: [{ [sortField]: direction }, ...(sortField === 'id' ? [] : [{ id: direction }])],
      skip: ranked ? 0 : pagination.skip,
      take: pagination.limit,
      include: {
        _count: { select: { orders: true } }
      }
    });
    
    const clients = ranked
      ? ranked.map(row => ({ ...pageClients.find(client => client.id === row.id)!, totalSpent: Number(row.totalSpent) }))
      : await withClientFinancialTotals(prisma, pageClients);
    const total = await prisma.client.count({ where });
    
    res.json({
      clients,
      total,
      page: pagination.page,
      limit: pagination.limit
    });
  } catch (error) {
    console.error('Error in getAllClients:', error);
    res.status(500).json({ error: 'Ошибка получения клиентов' });
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
    
    res.json((await withClientFinancialTotals(prisma, [client]))[0]);
  } catch (error) {
    console.error('Error in getClientById:', error);
    res.status(500).json({ error: 'Ошибка получения клиента' });
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
      notes,
      discountPercent
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
    
    // Валидация скидки
    let finalDiscount = 0;
    if (discountPercent !== undefined) {
      finalDiscount = Math.min(100, Math.max(0, discountPercent));
    }
    
    const client = await prisma.client.create({
      data: {
        firstName,
        lastName,
        middleName, // ✅ ОТЧЕСТВО
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
        notes,
        discountPercent: finalDiscount,
        discountUpdatedAt: finalDiscount > 0 ? new Date() : null,
        discountUpdatedBy: req.user?.id
      }
    });
    
    // Логируем создание клиента со скидкой
    if (finalDiscount > 0 && req.user) {
      await auditService.log(
        { id: req.user.id, name: req.user.name, role: req.user.role },
        `Создан клиент "${firstName} ${lastName || ''} ${middleName || ''}" со скидкой ${finalDiscount}%`,
        { clientId: client.id, discountPercent: finalDiscount }
      );
    }
    
    res.status(201).json(client);
  } catch (error) {
    console.error('Error in createClient:', error);
    res.status(500).json({ error: 'Ошибка создания клиента' });
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
    const oldClient = await prisma.client.findUnique({ where: { id: clientId } });
    
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
    
    // Валидация скидки
    let discountChanged = false;
    let oldDiscount = oldClient?.discountPercent || 0;
    let newDiscount = updateData.discountPercent !== undefined 
      ? Math.min(100, Math.max(0, updateData.discountPercent)) 
      : oldDiscount;
    
    if (updateData.discountPercent !== undefined && oldDiscount !== newDiscount) {
      discountChanged = true;
    }
    
    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        phone: updateData.phone,
        email: updateData.email,
        preferredContact: updateData.preferredContact,
        address: updateData.address,
        city: updateData.city,
        passport: updateData.passport,
        driverLicense: updateData.driverLicense,
        carModel: updateData.carModel,
        carVin: updateData.carVin,
        carNumber: updateData.carNumber,
        notes: updateData.notes,
        discountPercent: updateData.discountPercent !== undefined ? newDiscount : undefined,
        discountUpdatedAt: discountChanged ? new Date() : undefined,
        discountUpdatedBy: discountChanged ? req.user?.id : undefined,
        // ✅ Убедимся, что middleName обновляется
        middleName: updateData.middleName !== undefined ? updateData.middleName : oldClient?.middleName,
        birthDate: updateData.birthDate ? new Date(updateData.birthDate) : undefined,
        carYear: updateData.carYear ? parseInt(updateData.carYear) : undefined
      }
    });
    
    // Логируем изменение скидки
    if (discountChanged && req.user) {
      await auditService.log(
        { id: req.user.id, name: req.user.name, role: req.user.role },
        `Изменена скидка клиента "${client.firstName} ${client.lastName || ''} ${client.middleName || ''}" с ${oldDiscount}% на ${newDiscount}%`,
        { clientId, oldDiscount, newDiscount }
      );
    }
    
    res.json((await withClientFinancialTotals(prisma, [client]))[0]);
  } catch (error) {
    console.error('Error in updateClient:', error);
    res.status(500).json({ error: 'Ошибка обновления клиента' });
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
    res.status(500).json({ error: 'Ошибка удаления клиента' });
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
          { middleName: { contains: q, mode: 'insensitive' } }, // ✅
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
    
    res.json({ clients: await withClientFinancialTotals(prisma, clients) });
  } catch (error) {
    console.error('Error in searchClients:', error);
    res.status(500).json({ error: 'Ошибка поиска клиентов' });
  }
};

/**
 * GET /api/clients/stats/summary
 * Получить статистику по клиентам
 */
export const getClientsStats = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const totalClients = await prisma.client.count();
    
    const totalSpentResult = await prisma.saleDocument.aggregate({
      where: { ...paidSaleWhere(), clientId: { not: null } }, _sum: { total: true }
    });
    const ranked = await clientsRankedBySpending(prisma, { limit: 10 });
    
    const selectedClients = await prisma.client.findMany({
      where: { id: { in: ranked.map(row => row.id) } },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phone: true,
        totalOrders: true,
        totalSpent: true,
        discountPercent: true
      }
    });
    
    const topClients = ranked.map(row => ({ ...selectedClients.find(client => client.id === row.id)!, totalSpent: Number(row.totalSpent) }));

    const newClientsThisMonth = await prisma.client.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }
    });
    
    res.json({
      totalClients,
      totalSpent: totalSpentResult._sum.total || 0,
      topClients,
      newClientsThisMonth
    });
  } catch (error) {
    console.error('Error in getClientsStats:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
};

/**
 * PATCH /api/clients/:id/discount
 * Обновить только скидку клиента
 */
export const updateClientDiscount = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const clientId = parseInt(id);
    const { discountPercent }: UpdateClientDiscountDTO = req.body;
    
    if (isNaN(clientId)) {
      res.status(400).json({ error: 'Неверный ID клиента' });
      return;
    }
    
    if (discountPercent === undefined || isNaN(discountPercent)) {
      res.status(400).json({ error: 'Укажите discountPercent (0-100)' });
      return;
    }
    
    const validDiscount = Math.min(100, Math.max(0, discountPercent));
    
    const oldClient = await prisma.client.findUnique({
      where: { id: clientId },
      select: { firstName: true, lastName: true, middleName: true, discountPercent: true }
    });
    
    if (!oldClient) {
      res.status(404).json({ error: 'Клиент не найден' });
      return;
    }
    
    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        discountPercent: validDiscount,
        discountUpdatedAt: new Date(),
        discountUpdatedBy: req.user?.id
      }
    });
    
    // Логируем изменение скидки
    if (req.user) {
      await auditService.log(
        { id: req.user.id, name: req.user.name, role: req.user.role },
        `Изменена скидка клиента "${oldClient.firstName} ${oldClient.lastName || ''} ${oldClient.middleName || ''}" с ${oldClient.discountPercent}% на ${validDiscount}%`,
        { clientId, oldDiscount: oldClient.discountPercent, newDiscount: validDiscount }
      );
    }
    
    res.json({ 
      message: 'Скидка клиента обновлена',
      client: {
        id: client.id,
        discountPercent: client.discountPercent,
        discountUpdatedAt: client.discountUpdatedAt
      }
    });
  } catch (error) {
    console.error('Error in updateClientDiscount:', error);
    res.status(500).json({ error: 'Ошибка обновления скидки' });
  }
};
