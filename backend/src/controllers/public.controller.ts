// crm-project/backend/src/controllers/public/products.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { productAvailability } from '../domain/productAvailability';
import {
  absolutePublicUrl,
  buildProductImageHttpResponse,
  productImageMetadataSelect,
  productImageUrl,
} from '../services/productImages.service';

const prisma = new PrismaClient();

/**
 * GET /api/public/products
 * Публичный эндпоинт для получения товаров (без JWT)
 */
export const getPublicProducts = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { category, carModel, search, page = '1', limit = '12' } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 12;
    const skip = (pageNum - 1) * limitNum;

    // Строим фильтры
    // Product has no separate publication flag. Zero free stock does not unpublish it.
    const where: any = {};

    // Фильтр по поиску
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { article: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Фильтр по категории (через связи)
    if (category) {
      const categoryValue = String(category).trim();
      where.categories = {
        some: /^\d+$/.test(categoryValue)
          ? { categoryId: Number(categoryValue) }
          : { category: { name: { equals: categoryValue, mode: 'insensitive' } } },
      };
    }

    // Получаем товары с изображениями
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          categories: {
            include: {
              category: true,
            },
          },
          images: {
            orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
            select: productImageMetadataSelect,
          },
          characteristics: {
            include: {
              field: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where }),
    ]);

    // Форматируем ответ
    const formattedProducts = products.map((product) => {
      // Собираем категории
      const categories = product.categories.map((pc: any) => ({
        id: pc.category.id,
        name: pc.category.name,
      }));

      // Собираем характеристики
      const characteristics: Record<string, any> = {};
      product.characteristics.forEach((char: any) => {
        if (char.field?.name) {
          try {
            characteristics[char.field.name] = JSON.parse(char.value);
          } catch {
            characteristics[char.field.name] = char.value;
          }
        }
      });

      // Формируем URL изображений из таблицы ProductImage
      const images = product.images.map((img) => productImageUrl(req, img));

      // Если есть image_url, добавляем его в начало (для обратной совместимости)
      if (product.image_url && images.length === 0) {
        const mainImage = absolutePublicUrl(req, product.image_url);
        images.unshift(mainImage);
      }

      // Если нет изображений — ставим заглушку
      const finalImages = images.length > 0 ? images : ['/images/placeholder.jpg'];

      return {
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.retail_price,
        oldPrice: null,
        category: categories.length > 0 ? categories[0].name : '',
        categories: categories,
        carModel: 'Универсальный',
        ...productAvailability(product.stock),
        images: finalImages,
        sku: product.article || '',
        rating: null,
        reviews: null,
        characteristics: characteristics,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });

    res.json({
      items: formattedProducts,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Error in getPublicProducts:', error);
    res.status(500).json({ error: 'Ошибка получения товаров' });
  }
};

/**
 * GET /api/public/products/:id
 * Публичный эндпоинт для получения товара по ID
 */
export const getPublicProductById = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { id } = req.params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      res.status(400).json({ error: 'Неверный ID товара' });
      return;
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        categories: {
          include: {
            category: {
              include: {
                fields: true,
              },
            },
          },
        },
        images: {
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
          select: productImageMetadataSelect,
        },
        characteristics: {
          include: {
            field: true,
          },
        },
      },
    });

    if (!product) {
      res.status(404).json({ error: 'Товар не найден' });
      return;
    }

    // Формируем характеристики
    const characteristics: Record<string, any> = {};
    product.characteristics.forEach((char: any) => {
      if (char.field?.name) {
        try {
          characteristics[char.field.name] = JSON.parse(char.value);
        } catch {
          characteristics[char.field.name] = char.value;
        }
      }
    });

    const images = product.images.map((img) => productImageUrl(req, img));

    if (product.image_url && images.length === 0) {
      const mainImage = absolutePublicUrl(req, product.image_url);
      images.unshift(mainImage);
    }

    const finalImages = images.length > 0 ? images : ['/images/placeholder.jpg'];

    const formattedProduct = {
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.retail_price,
      oldPrice: null,
      category: product.categories?.[0]?.category?.name || '',
      categories: product.categories.map((pc: any) => ({
        id: pc.category.id,
        name: pc.category.name,
      })),
      carModel: 'Универсальный',
      ...productAvailability(product.stock),
      images: finalImages,
      sku: product.article || '',
      rating: null,
      reviews: null,
      characteristics,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    res.json(formattedProduct);
  } catch (error) {
    console.error('Error in getPublicProductById:', error);
    res.status(500).json({ error: 'Ошибка получения товара' });
  }
};

export const getPublicProductImage = async (req: Request, res: Response): Promise<void> => {
  const productId = Number.parseInt(req.params.productId, 10);
  const imageId = Number.parseInt(req.params.imageId, 10);
  if (!Number.isInteger(productId) || !Number.isInteger(imageId)) {
    res.status(400).json({ error: 'Неверный ID изображения' });
    return;
  }

  try {
    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId },
      select: {
        data: true,
        mimeType: true,
        size: true,
        contentHash: true,
        updatedAt: true,
      },
    });

    const response = buildProductImageHttpResponse(image, req.headers['if-none-match']);
    if (!response) {
      res.status(404).json({ error: 'Изображение не найдено' });
      return;
    }

    if (response.status === 304) {
      res.status(304).end();
      return;
    }

    res.set(response.headers);
    res.send(response.body);
  } catch (error) {
    console.error('Error getting public product image:', error);
    res.status(500).json({ error: 'Ошибка получения изображения' });
  }
};

/**
 * GET /api/public/categories
 * Публичный эндпоинт для получения категорий
 */
export const getPublicCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(categories);
  } catch (error) {
    console.error('Error in getPublicCategories:', error);
    res.status(500).json({ error: 'Ошибка получения категорий' });
  }
};
