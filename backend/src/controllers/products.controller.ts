import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { RequestWithUser, CreateProductDTO, UpdateProductDTO } from '../types';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

const MAX_PRODUCT_IMAGES = 5;

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
  characteristics: Record<string, string | string[]>;
}

const formatProduct = (product: any): FormattedProduct => {
  const characteristics: Record<string, string | string[]> = {};
  
  if (product.characteristics) {
    product.characteristics.forEach((char: any) => {
      if (char.field && char.field.name) {
        try {
          const parsedValue = JSON.parse(char.value);
          if (Array.isArray(parsedValue)) {
            characteristics[char.field.name] = parsedValue;
          } else {
            characteristics[char.field.name] = char.value;
          }
        } catch {
          characteristics[char.field.name] = char.value;
        }
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
        },
        images: {
          orderBy: { sortOrder: 'asc' }
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

export const getProductById = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    
    if (isNaN(productId)) {
      res.status(400).json({ message: 'Неверный ID товара' });
      return;
    }
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
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
        },
        images: {
          orderBy: { sortOrder: 'asc' }
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

export const createProduct = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const data: CreateProductDTO = req.body;
    
    if (!data.name || data.cost_price === undefined || data.retail_price === undefined || data.stock === undefined) {
      res.status(400).json({ message: 'Заполните все обязательные поля' });
      return;
    }
    
    if (data.article) {
      const existing = await prisma.product.findUnique({
        where: { article: data.article }
      });
      
      if (existing) {
        res.status(400).json({ message: 'Артикул уже существует' });
        return;
      }
    }
    
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
      
      if (data.categoryIds && data.categoryIds.length > 0) {
        const categoryConnections = data.categoryIds.map((categoryId: number) => ({
          productId: product.id,
          categoryId
        }));
        
        await tx.productCategory.createMany({
          data: categoryConnections
        });
      }
      
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

export const updateProduct = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    const data: UpdateProductDTO = req.body;
    const userId = req.user?.id;
    
    console.log('=== updateProduct called ===');
    console.log('Product ID:', productId);
    console.log('User ID:', userId);
    console.log('Data:', JSON.stringify(data, null, 2));
    
    if (isNaN(productId)) {
      res.status(400).json({ message: 'Неверный ID товара' });
      return;
    }
    
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existingProduct = await tx.product.findUnique({
        where: { id: productId }
      });
      
      if (!existingProduct) {
        throw new Error('Товар не найден');
      }
      
      // Проверяем, изменилась ли цена
      const oldPrice = existingProduct.retail_price;
      const newPrice = data.retail_price !== undefined ? data.retail_price : oldPrice;
      const priceChanged = data.retail_price !== undefined && data.retail_price !== oldPrice;
      
      console.log(`Price check: old=${oldPrice}, new=${newPrice}, changed=${priceChanged}`);
      
      if (data.article && data.article !== existingProduct.article) {
        const existing = await tx.product.findFirst({
          where: {
            article: data.article,
            id: { not: productId }
          }
        });
        
        if (existing) {
          throw new Error('Артикул уже существует');
        }
      }
      
      const product = await tx.product.update({
        where: { id: productId },
        data: {
          name: data.name !== undefined ? data.name : existingProduct.name,
          article: data.article !== undefined ? data.article : existingProduct.article,
          cost_price: data.cost_price !== undefined ? data.cost_price : existingProduct.cost_price,
          retail_price: newPrice,
          stock: data.stock !== undefined ? data.stock : existingProduct.stock,
          min_stock: data.min_stock !== undefined ? data.min_stock : existingProduct.min_stock,
          description: data.description !== undefined ? data.description : existingProduct.description,
          image_url: data.image_url !== undefined ? data.image_url : existingProduct.image_url,
          costBreakdown: data.costBreakdown !== undefined ? data.costBreakdown : existingProduct.costBreakdown
        }
      });
      
      // ЕСЛИ ЦЕНА ИЗМЕНИЛАСЬ - СОЗДАЁМ ЗАПИСЬ В ИСТОРИИ
      if (priceChanged && userId) {
        const changeType = newPrice > oldPrice ? 'increase' : 'decrease';
        const reason = data.priceChangeReason || `Изменение цены через редактирование товара (${oldPrice} → ${newPrice})`;
        
        const historyRecord = await tx.priceHistory.create({
          data: {
            productId,
            oldPrice,
            newPrice,
            changeType,
            reason: reason,
            changedBy: userId
          }
        });
        console.log('✅ Price history created:', historyRecord);
      } else if (priceChanged && !userId) {
        console.log('⚠️ Price changed but no userId, skipping history');
      } else {
        console.log('ℹ️ Price not changed, skipping history');
      }
      
      // Обновляем категории
      if (data.categoryIds !== undefined) {
        await tx.productCategory.deleteMany({
          where: { productId: product.id }
        });
        
        if (data.categoryIds.length > 0) {
          const categoryConnections = data.categoryIds.map((categoryId: number) => ({
            productId: product.id,
            categoryId
          }));
          
          await tx.productCategory.createMany({
            data: categoryConnections
          });
        }
      }
      
      // Обновляем характеристики
      if (data.characteristics !== undefined) {
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
      }
      
      return product;
    });
    
    console.log('=== updateProduct SUCCESS ===');
    res.json(result);
  } catch (error) {
    console.error('=== updateProduct ERROR ===');
    console.error(error);
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

export const deleteProduct = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    
    if (isNaN(productId)) {
      res.status(400).json({ message: 'Неверный ID товара' });
      return;
    }
    
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true }
    });
    
    if (!existingProduct) {
      res.status(404).json({ message: 'Товар не найден' });
      return;
    }
    
    for (const image of existingProduct.images) {
      const filePath = path.join(__dirname, '../../uploads/products', image.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
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

export const getPriceHistory = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    
    if (isNaN(productId)) {
      res.status(400).json({ message: 'Неверный ID товара' });
      return;
    }
    
    const history = await prisma.priceHistory.findMany({
      where: { productId },
      orderBy: { changedAt: 'desc' }
    });
    
    const userIds = [...new Set(history.map(h => h.changedBy))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true }
    });
    
    const userMap = new Map(users.map(u => [u.id, u]));
    
    const formattedHistory = history.map(h => ({
      id: h.id,
      oldPrice: h.oldPrice,
      newPrice: h.newPrice,
      changeType: h.changeType,
      reason: h.reason,
      changedAt: h.changedAt,
      changedBy: {
        id: h.changedBy,
        name: userMap.get(h.changedBy)?.name || 'Неизвестный'
      }
    }));
    
    res.json(formattedHistory);
  } catch (error) {
    console.error('Error getting price history:', error);
    res.status(500).json({ message: 'Ошибка загрузки истории цен' });
  }
};

// backend/src/controllers/products.controller.ts
export const updateProductPrice = async (req: RequestWithUser, res: Response): Promise<void> => {
  console.log('=== updateProductPrice START ===');
  console.log('req.body:', JSON.stringify(req.body, null, 2));
  console.log('req.params:', req.params);
  console.log('req.user:', req.user);
  
  try {
    const { id } = req.params;
    // ВАЖНО: проверяем оба варианта названия поля
    const { newPrice, retail_price, reason } = req.body;
    const productId = parseInt(id);
    const userId = req.user?.id;
    
    console.log('Parsed values:', { productId, newPrice, retail_price, reason, userId });
    
    if (!userId) {
      console.log('No userId!');
      res.status(401).json({ message: 'Не авторизован' });
      return;
    }
    
    if (isNaN(productId)) {
      console.log('Invalid productId');
      res.status(400).json({ message: 'Неверный ID товара' });
      return;
    }
    
    // Поддерживаем оба варианта: newPrice или retail_price
    const priceToUse = newPrice !== undefined ? newPrice : retail_price;
    
    if (priceToUse === undefined || priceToUse < 0) {
      console.log('Invalid price:', priceToUse);
      res.status(400).json({ message: 'Укажите корректную цену' });
      return;
    }
    
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId }
      });
      
      if (!product) {
        throw new Error('Товар не найден');
      }
      
      const oldPrice = product.retail_price;
      const newPriceNum = parseFloat(priceToUse);
      
      console.log(`Price change: ${oldPrice} -> ${newPriceNum}, reason: ${reason}`);
      
      if (oldPrice === newPriceNum) {
        console.log('Prices are equal, no change');
        return product;
      }
      
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { retail_price: newPriceNum }
      });
      
      const historyRecord = await tx.priceHistory.create({
        data: {
          productId,
          oldPrice,
          newPrice: newPriceNum,
          changeType: newPriceNum > oldPrice ? 'increase' : 'decrease',
          reason: reason || null,
          changedBy: userId
        }
      });
      
      console.log('History record created:', historyRecord);
      
      return updatedProduct;
    });
    
    console.log('Update successful');
    res.json(result);
  } catch (error) {
    console.error('Error updating product price:', error);
    if (error instanceof Error && error.message === 'Товар не найден') {
      res.status(404).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Ошибка обновления цены' });
  }
};

export const getProductImages = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    
    if (isNaN(productId)) {
      res.status(400).json({ message: 'Неверный ID товара' });
      return;
    }
    
    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: [
        { isMain: 'desc' },
        { sortOrder: 'asc' }
      ]
    });
    
    res.json(images);
  } catch (error) {
    console.error('Error getting product images:', error);
    res.status(500).json({ message: 'Ошибка загрузки фото' });
  }
};

export const uploadProductImage = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    
    if (isNaN(productId)) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(400).json({ message: 'Неверный ID товара' });
      return;
    }
    
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: 'Файл не загружен' });
      return;
    }
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true }
    });
    
    if (!product) {
      fs.unlinkSync(file.path);
      res.status(404).json({ message: 'Товар не найден' });
      return;
    }
    
    if (product.images.length >= MAX_PRODUCT_IMAGES) {
      fs.unlinkSync(file.path);
      res.status(400).json({ message: `Максимум ${MAX_PRODUCT_IMAGES} фото на товар` });
      return;
    }
    
    const baseUrl = process.env.BASE_URL || `http://localhost:5000`;
    const imageUrl = `${baseUrl}/uploads/products/${file.filename}`;
    
    const existingImagesCount = product.images.length;
    
    const productImage = await prisma.productImage.create({
      data: {
        productId,
        url: imageUrl,
        filename: file.filename,
        size: file.size,
        isMain: existingImagesCount === 0,
        sortOrder: existingImagesCount
      }
    });
    
    if (existingImagesCount === 0) {
      await prisma.product.update({
        where: { id: productId },
        data: { image_url: imageUrl }
      });
    }
    
    res.status(201).json(productImage);
  } catch (error) {
    console.error('Error uploading image:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Ошибка загрузки фото' });
  }
};

export const deleteProductImage = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id, imageId } = req.params;
    const productId = parseInt(id);
    const imageIdNum = parseInt(imageId);
    
    if (isNaN(productId) || isNaN(imageIdNum)) {
      res.status(400).json({ message: 'Неверные ID' });
      return;
    }
    
    await prisma.$transaction(async (tx) => {
      const image = await tx.productImage.findFirst({
        where: { id: imageIdNum, productId }
      });
      
      if (!image) {
        throw new Error('Фото не найдено');
      }
      
      const filePath = path.join(__dirname, '../../uploads/products', image.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      await tx.productImage.delete({
        where: { id: imageIdNum }
      });
      
      if (image.isMain) {
        const nextImage = await tx.productImage.findFirst({
          where: { productId },
          orderBy: { sortOrder: 'asc' }
        });
        
        if (nextImage) {
          await tx.productImage.update({
            where: { id: nextImage.id },
            data: { isMain: true }
          });
          
          await tx.product.update({
            where: { id: productId },
            data: { image_url: nextImage.url }
          });
        } else {
          await tx.product.update({
            where: { id: productId },
            data: { image_url: null }
          });
        }
      }
    });
    
    res.json({ message: 'Фото удалено' });
  } catch (error) {
    console.error('Error deleting image:', error);
    if (error instanceof Error && error.message === 'Фото не найдено') {
      res.status(404).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Ошибка удаления фото' });
  }
};

export const setMainProductImage = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id, imageId } = req.params;
    const productId = parseInt(id);
    const imageIdNum = parseInt(imageId);
    
    if (isNaN(productId) || isNaN(imageIdNum)) {
      res.status(400).json({ message: 'Неверные ID' });
      return;
    }
    
    const result = await prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({
        where: { productId },
        data: { isMain: false }
      });
      
      const image = await tx.productImage.update({
        where: { id: imageIdNum },
        data: { isMain: true }
      });
      
      await tx.product.update({
        where: { id: productId },
        data: { image_url: image.url }
      });
      
      return image;
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error setting main image:', error);
    res.status(500).json({ message: 'Ошибка установки главного фото' });
  }
}; 