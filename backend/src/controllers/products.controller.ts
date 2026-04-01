// backend/src/controllers/products.controller.ts
import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { RequestWithUser, CreateProductDTO, UpdateProductDTO } from '../types';

const prisma = new PrismaClient();

// Тип для форматированного товара
interface FormattedProduct {
  id: number;
  name: string;
  article: string | null;
  categoryIds: number[];
  categories: Array<{
    id: number;
    name: string;
    fields: any[];
  }>;
  cost_price: number;
  retail_price: number;
  description: string | null;
  stock: number;
  min_stock: number;
  image_url: string | null;
  costBreakdown: any;
  createdAt: Date;
  updatedAt: Date;
  characteristics: Record<string, string>;
}

/**
 * Форматирует товар из БД в формат для фронтенда
 */
const formatProduct = (product: any): FormattedProduct => {
  const characteristics: Record<string, string> = {};
  
  if (product.characteristics) {
    product.characteristics.forEach((char: any) => {
      if (char.field && char.field.name) {
        characteristics[char.field.name] = char.value;
      }
    });
  }
  
  return {
    id: product.id,
    name: product.name,
    article: product.article,
    categoryIds: product.categories?.map((pc: any) => pc.categoryId) || [],
    categories: product.categories?.map((pc: any) => ({
      id: pc.category.id,
      name: pc.category.name,
      fields: pc.category.fields || []
    })) || [],
    cost_price: product.cost_price,
    retail_price: product.retail_price,
    description: product.description,
    stock: product.stock,
    min_stock: product.min_stock,
    image_url: product.image_url,
    costBreakdown: product.costBreakdown || [],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    characteristics
  };
};

/**
 * GET /api/products
 * Получить все товары с категориями
 */
export const getProducts = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      include: {
        categories: {
          include: {
            category: {
              include: {
                fields: true
              }
            }
          }
        },
        characteristics: {
          include: {
            field: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const formattedProducts = products.map(formatProduct);
    res.json(formattedProducts);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ message: 'Ошибка загрузки товаров' });
  }
};

/**
 * GET /api/products/:id
 * Получить один товар
 */
export const getProductById = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        categories: {
          include: {
            category: {
              include: {
                fields: true
              }
            }
          }
        },
        characteristics: {
          include: {
            field: true
          }
        }
      }
    });
    
    if (!product) {
      res.status(404).json({ message: 'Товар не найден' });
      return;
    }
    
    res.json(formatProduct(product));
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({ message: 'Ошибка загрузки товара' });
  }
};

/**
 * POST /api/products
 * Создать товар
 */
export const createProduct = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const data: CreateProductDTO = req.body;
    
    // Проверка обязательных полей
    if (!data.name || data.cost_price === undefined || data.retail_price === undefined || data.stock === undefined) {
      res.status(400).json({ message: 'Заполните все обязательные поля' });
      return;
    }
    
    // Проверка уникальности артикула
    if (data.article) {
      const existing = await prisma.product.findUnique({
        where: { article: data.article }
      });
      
      if (existing) {
        res.status(400).json({ message: 'Артикул уже существует' });
        return;
      }
    }
    
    // Создаем товар в транзакции
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Создаем товар
      const product = await tx.product.create({
        data: {
          name: data.name,
          article: data.article || null,
          cost_price: data.cost_price,
          retail_price: data.retail_price,
          stock: data.stock,
          min_stock: data.min_stock || 5,
          description: data.description || null,
          image_url: data.image_url || null,
          costBreakdown: data.costBreakdown || []
        }
      });
      
      // Добавляем связи с категориями
      if (data.categoryIds && data.categoryIds.length > 0) {
        const categoryConnections = data.categoryIds.map((categoryId: number) => ({
          productId: product.id,
          categoryId
        }));
        
        await tx.productCategory.createMany({
          data: categoryConnections
        });
      }
      
      // Добавляем характеристики
      if (data.characteristics && Object.keys(data.characteristics).length > 0) {
        for (const [fieldId, value] of Object.entries(data.characteristics)) {
          if (value && value !== '' && value !== null) {
            const fieldExists = await tx.categoryField.findUnique({
              where: { id: parseInt(fieldId) }
            });
            
            if (fieldExists) {
              await tx.productCharacteristic.create({
                data: {
                  productId: product.id,
                  fieldId: parseInt(fieldId),
                  value: typeof value === 'object' ? JSON.stringify(value) : String(value)
                }
              });
            }
          }
        }
      }
      
      return product;
    });
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: `Ошибка создания товара: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
};

/**
 * PUT /api/products/:id
 * Обновить товар
 */
export const updateProduct = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data: UpdateProductDTO = req.body;
    
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Проверяем существование товара
      const existingProduct = await tx.product.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!existingProduct) {
        throw new Error('Товар не найден');
      }
      
      // Проверяем уникальность артикула (если изменился)
      if (data.article && data.article !== existingProduct.article) {
        const existing = await tx.product.findFirst({
          where: {
            article: data.article,
            id: { not: parseInt(id) }
          }
        });
        
        if (existing) {
          throw new Error('Артикул уже существует');
        }
      }
      
      // Обновляем товар
      const product = await tx.product.update({
        where: { id: parseInt(id) },
        data: {
          name: data.name !== undefined ? data.name : existingProduct.name,
          article: data.article !== undefined ? data.article : existingProduct.article,
          cost_price: data.cost_price !== undefined ? data.cost_price : existingProduct.cost_price,
          retail_price: data.retail_price !== undefined ? data.retail_price : existingProduct.retail_price,
          stock: data.stock !== undefined ? data.stock : existingProduct.stock,
          min_stock: data.min_stock !== undefined ? data.min_stock : existingProduct.min_stock,
          description: data.description !== undefined ? data.description : existingProduct.description,
          image_url: data.image_url !== undefined ? data.image_url : existingProduct.image_url,
          costBreakdown: data.costBreakdown !== undefined ? data.costBreakdown : existingProduct.costBreakdown
        }
      });
      
      // Обновляем связи с категориями (удаляем старые, добавляем новые)
      await tx.productCategory.deleteMany({
        where: { productId: product.id }
      });
      
      if (data.categoryIds && data.categoryIds.length > 0) {
        const categoryConnections = data.categoryIds.map((categoryId: number) => ({
          productId: product.id,
          categoryId
        }));
        
        await tx.productCategory.createMany({
          data: categoryConnections
        });
      }
      
      // Обновляем характеристики
      await tx.productCharacteristic.deleteMany({
        where: { productId: product.id }
      });
      
      if (data.characteristics && Object.keys(data.characteristics).length > 0) {
        for (const [fieldId, value] of Object.entries(data.characteristics)) {
          if (value && value !== '' && value !== null) {
            const fieldExists = await tx.categoryField.findUnique({
              where: { id: parseInt(fieldId) }
            });
            
            if (fieldExists) {
              await tx.productCharacteristic.create({
                data: {
                  productId: product.id,
                  fieldId: parseInt(fieldId),
                  value: typeof value === 'object' ? JSON.stringify(value) : String(value)
                }
              });
            }
          }
        }
      }
      
      return product;
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error updating product:', error);
    if (error instanceof Error) {
      if (error.message === 'Артикул уже существует') {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error.message === 'Товар не найден') {
        res.status(404).json({ message: error.message });
        return;
      }
    }
    res.status(500).json({ message: `Ошибка обновления товара: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
};

/**
 * DELETE /api/products/:id
 * Удалить товар
 */
export const deleteProduct = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    
    if (isNaN(productId)) {
      res.status(400).json({ message: 'Неверный ID товара' });
      return;
    }
    
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (!existingProduct) {
      res.status(404).json({ message: 'Товар не найден' });
      return;
    }
    
    await prisma.product.delete({
      where: { id: productId }
    });
    
    res.json({ message: 'Товар удален' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Ошибка удаления товара' });
  }
};

/**
 * GET /api/products/low-stock
 * Получить товары с низким остатком
 */
export const getLowStockProducts = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      where: {
        stock: {
          lte: prisma.product.fields.min_stock
        }
      },
      include: {
        categories: {
          include: {
            category: true
          }
        }
      },
      orderBy: { stock: 'asc' }
    });
    
    const formattedProducts = products.map((product: any) => ({
      id: product.id,
      name: product.name,
      article: product.article,
      categoryIds: product.categories.map((pc: any) => pc.categoryId),
      categories: product.categories.map((pc: any) => pc.category),
      cost_price: product.cost_price,
      retail_price: product.retail_price,
      stock: product.stock,
      min_stock: product.min_stock,
      costBreakdown: product.costBreakdown || []
    }));
    
    res.json(formattedProducts);
  } catch (error) {
    console.error('Error getting low stock products:', error);
    res.status(500).json({ message: 'Ошибка загрузки товаров с низким остатком' });
  }
};