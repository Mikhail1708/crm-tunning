// backend/src/controllers/products.controller.ts
import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { RequestWithUser, CreateProductDTO, UpdateProductDTO } from '../types';
import { RequestWithProcessedImage } from '../middleware/upload.middleware';
import {
  deleteProductImageRecord,
  productImageBinaryPath,
  productImageCreateData,
  productImageMetadataDto,
  productImageMetadataSelect,
  ProductImageNotFoundError,
  setMainProductImageRecord,
} from '../services/productImages.service';

import { deleteProductPreservingHistory } from '../services/productDeletion.service';
import { lockStockProducts, SaleStockError } from '../services/saleStock.service';

const prisma = new PrismaClient();

function validateStock(stock: unknown): void {
  if (!Number.isInteger(stock) || (stock as number) < 0 || (stock as number) > 2_147_483_647) {
    throw new SaleStockError(400, 'INVALID_STOCK', 'Остаток должен быть неотрицательным целым числом');
  }
}

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
    validateStock(data.stock);
    
    if (!data.name || data.cost_price === undefined || data.retail_price === undefined || data.stock === undefined) {
      res.status(400).json({ message: 'Заполните все обязательные поля' });
      return;
    }
    
    if (data.article) {
      const existing = await prisma.product.findFirst({
        where: { article: data.article }
      });
      
      if (existing) {
        res.status(400).json({ message: `Артикул "${data.article}" уже существует` });
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
    if (error instanceof SaleStockError) {
      res.status(error.status).json({ code: error.code, message: error.message });
      return;
    }
    console.error('Error creating product:', error);
    res.status(500).json({ message: `Ошибка создания товара: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
};

export const updateProduct = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    const data: UpdateProductDTO = req.body;
    if (data.stock !== undefined) validateStock(data.stock);
    const userId = req.user?.id;
    
    console.log('=== updateProduct called ===');
    console.log('Product ID:', productId);
    console.log('User ID:', userId);
    
    if (isNaN(productId)) {
      res.status(400).json({ message: 'Неверный ID товара' });
      return;
    }
    
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockStockProducts(tx, [productId]);
      const existingProduct = await tx.product.findUnique({
        where: { id: productId }
      });
      
      if (!existingProduct) {
        throw new Error('Товар не найден');
      }
      
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
          stock: data.stock,
          min_stock: data.min_stock !== undefined ? data.min_stock : existingProduct.min_stock,
          description: data.description !== undefined ? data.description : existingProduct.description,
          image_url: data.image_url !== undefined ? data.image_url : existingProduct.image_url,
          costBreakdown: data.costBreakdown !== undefined ? data.costBreakdown : existingProduct.costBreakdown
        }
      });
      
      if (priceChanged && userId) {
        const changeType = newPrice > oldPrice ? 'increase' : 'decrease';
        const reason = data.priceChangeReason || `Изменение цены через редактирование товара (${oldPrice} → ${newPrice})`;
        
        await tx.priceHistory.create({
          data: {
            productId,
            oldPrice,
            newPrice,
            changeType,
            reason: reason,
            changedBy: userId
          }
        });
        console.log('✅ Price history created');
      }
      
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
    if (error instanceof SaleStockError) {
      res.status(error.status).json({ code: error.code, message: error.message });
      return;
    }
    console.error('=== updateProduct ERROR ===', error);
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
    
    await deleteProductPreservingHistory(prisma, productId);

    res.json({ message: 'Товар удален' });
  } catch (error) {
    if (error instanceof SaleStockError) {
      res.status(error.status).json({ code: error.code, message: error.message });
      return;
    }
    if ((error as any)?.code === 'P2003') {
      res.status(409).json({ code: 'PRODUCT_HAS_HISTORY', message: 'Товар связан с историческими данными и не может быть удалён' });
      return;
    }
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

export const updateProductPrice = async (req: RequestWithUser, res: Response): Promise<void> => {
  console.log('=== updateProductPrice START ===');
  
  try {
    const { id } = req.params;
    const { newPrice, retail_price, reason } = req.body;
    const productId = parseInt(id);
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ message: 'Не авторизован' });
      return;
    }
    
    if (isNaN(productId)) {
      res.status(400).json({ message: 'Неверный ID товара' });
      return;
    }
    
    const priceToUse = newPrice !== undefined ? newPrice : retail_price;
    
    if (priceToUse === undefined || priceToUse < 0) {
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
        return product;
      }
      
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { retail_price: newPriceNum }
      });
      
      await tx.priceHistory.create({
        data: {
          productId,
          oldPrice,
          newPrice: newPriceNum,
          changeType: newPriceNum > oldPrice ? 'increase' : 'decrease',
          reason: reason || null,
          changedBy: userId
        }
      });
      
      console.log('History record created');
      return updatedProduct;
    });
    
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
      select: productImageMetadataSelect,
      orderBy: [
        { isMain: 'desc' },
        { sortOrder: 'asc' }
      ]
    });
    
    res.json(images.map((image) => productImageMetadataDto(req, image)));
  } catch (error) {
    console.error('Error getting product images:', error);
    res.status(500).json({ message: 'Ошибка загрузки фото' });
  }
};

// ============================================================
// ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ ФОТО
// ============================================================
export const uploadProductImage = async (req: RequestWithUser & RequestWithProcessedImage, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    
    if (isNaN(productId)) {
      res.status(400).json({ message: 'Неверный ID товара' });
      return;
    }
    
    const processedImage = req.processedImage;
    if (!processedImage) {
      res.status(400).json({ message: 'Файл не загружен' });
      return;
    }
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, _count: { select: { images: true } } }
    });
    
    if (!product) {
      res.status(404).json({ message: 'Товар не найден' });
      return;
    }
    
    if (product._count.images >= MAX_PRODUCT_IMAGES) {
      res.status(400).json({ message: `Максимум ${MAX_PRODUCT_IMAGES} фото на товар` });
      return;
    }
    
    const existingImagesCount = product._count.images;
    
    const productImage = await prisma.productImage.create({
      data: {
        ...productImageCreateData(productId, processedImage, existingImagesCount),
      },
      select: productImageMetadataSelect,
    });
    
    if (existingImagesCount === 0) {
      await prisma.product.update({
        where: { id: productId },
        data: { image_url: productImageBinaryPath(productId, productImage.id) }
      });
    }
    
    res.status(201).json(productImageMetadataDto(req, productImage));
  } catch (error) {
    console.error('❌ Error uploading image:', error);
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
    
    await prisma.$transaction((tx) => deleteProductImageRecord(tx, productId, imageIdNum));
    
    res.json({ message: 'Фото удалено' });
  } catch (error) {
    console.error('❌ Error deleting image:', error);
    if (error instanceof ProductImageNotFoundError) {
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
    
    const result = await prisma.$transaction((tx) => (
      setMainProductImageRecord(tx, productId, imageIdNum)
    ));
    
    res.json(productImageMetadataDto(req, result));
  } catch (error) {
    console.error('Error setting main image:', error);
    if (error instanceof ProductImageNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Ошибка установки главного фото' });
  }
};
