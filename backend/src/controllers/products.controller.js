// backend/src/controllers/products.controller.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Получить все товары с характеристиками
const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        productCategory: {
          include: {
            fields: true
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
    
    // Форматируем характеристики для удобства
    const formattedProducts = products.map(product => {
      const characteristics = {};
      if (product.characteristics) {
        product.characteristics.forEach(char => {
          if (char.field && char.field.name) {
            characteristics[char.field.name] = char.value;
          }
        });
      }
      
      return {
        id: product.id,
        name: product.name,
        article: product.article,
        category: product.category, // старое поле для обратной совместимости
        categoryId: product.categoryId,
        cost_price: product.cost_price,
        retail_price: product.retail_price,
        description: product.description,
        stock: product.stock,
        min_stock: product.min_stock,
        image_url: product.image_url,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        productCategory: product.productCategory,
        characteristics
      };
    });
    
    res.json(formattedProducts);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ message: 'Ошибка загрузки товаров' });
  }
};

// Получить один товар
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        productCategory: {
          include: {
            fields: true
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
      return res.status(404).json({ message: 'Товар не найден' });
    }
    
    const characteristics = {};
    if (product.characteristics) {
      product.characteristics.forEach(char => {
        if (char.field && char.field.name) {
          characteristics[char.field.name] = char.value;
        }
      });
    }
    
    res.json({
      id: product.id,
      name: product.name,
      article: product.article,
      category: product.category,
      categoryId: product.categoryId,
      cost_price: product.cost_price,
      retail_price: product.retail_price,
      description: product.description,
      stock: product.stock,
      min_stock: product.min_stock,
      image_url: product.image_url,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      productCategory: product.productCategory,
      characteristics
    });
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({ message: 'Ошибка загрузки товара' });
  }
};

// Создать товар
const createProduct = async (req, res) => {
  try {
    const { 
      name, 
      article, 
      cost_price, 
      retail_price, 
      stock, 
      min_stock, 
      description, 
      categoryId, 
      characteristics 
    } = req.body;
    
    // Проверка обязательных полей
    if (!name || !cost_price || !retail_price || stock === undefined) {
      return res.status(400).json({ message: 'Заполните все обязательные поля' });
    }
    
    // Проверка уникальности артикула
    if (article) {
      const existing = await prisma.product.findUnique({
        where: { article }
      });
      
      if (existing) {
        return res.status(400).json({ message: 'Артикул уже существует' });
      }
    }
    
    // Создаем товар в транзакции
    const result = await prisma.$transaction(async (prisma) => {
      const product = await prisma.product.create({
        data: {
          name,
          article: article || null,
          cost_price: parseFloat(cost_price),
          retail_price: parseFloat(retail_price),
          stock: parseInt(stock),
          min_stock: parseInt(min_stock) || 5,
          description: description || null,
          categoryId: categoryId ? parseInt(categoryId) : null
        }
      });
      
      // Добавляем характеристики
      if (characteristics && Object.keys(characteristics).length > 0) {
        for (const [fieldId, value] of Object.entries(characteristics)) {
          if (value && value !== '' && value !== null) {
            // Проверяем, существует ли поле
            const fieldExists = await prisma.categoryField.findUnique({
              where: { id: parseInt(fieldId) }
            });
            
            if (fieldExists) {
              await prisma.productCharacteristic.create({
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
    res.status(500).json({ message: 'Ошибка создания товара: ' + error.message });
  }
};

// Обновить товар
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      article, 
      cost_price, 
      retail_price, 
      stock, 
      min_stock, 
      description, 
      categoryId, 
      characteristics 
    } = req.body;
    
    const result = await prisma.$transaction(async (prisma) => {
      // Проверяем существование товара
      const existingProduct = await prisma.product.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!existingProduct) {
        throw new Error('Товар не найден');
      }
      
      // Проверяем уникальность артикула (если изменился)
      if (article && article !== existingProduct.article) {
        const existing = await prisma.product.findFirst({
          where: {
            article,
            id: { not: parseInt(id) }
          }
        });
        
        if (existing) {
          throw new Error('Артикул уже существует');
        }
      }
      
      // Обновляем товар
      const product = await prisma.product.update({
        where: { id: parseInt(id) },
        data: {
          name: name || existingProduct.name,
          article: article || null,
          cost_price: cost_price !== undefined ? parseFloat(cost_price) : existingProduct.cost_price,
          retail_price: retail_price !== undefined ? parseFloat(retail_price) : existingProduct.retail_price,
          stock: stock !== undefined ? parseInt(stock) : existingProduct.stock,
          min_stock: min_stock !== undefined ? parseInt(min_stock) : existingProduct.min_stock,
          description: description !== undefined ? description : existingProduct.description,
          categoryId: categoryId !== undefined ? (categoryId ? parseInt(categoryId) : null) : existingProduct.categoryId
        }
      });
      
      // Удаляем старые характеристики
      await prisma.productCharacteristic.deleteMany({
        where: { productId: product.id }
      });
      
      // Добавляем новые характеристики
      if (characteristics && Object.keys(characteristics).length > 0) {
        for (const [fieldId, value] of Object.entries(characteristics)) {
          if (value && value !== '' && value !== null) {
            const fieldExists = await prisma.categoryField.findUnique({
              where: { id: parseInt(fieldId) }
            });
            
            if (fieldExists) {
              await prisma.productCharacteristic.create({
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
    if (error.message === 'Артикул уже существует') {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === 'Товар не найден') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Ошибка обновления товара: ' + error.message });
  }
};

// Удалить товар
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверяем существование товара
    const existingProduct = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingProduct) {
      return res.status(404).json({ message: 'Товар не найден' });
    }
    
    // Удаляем товар (характеристики удалятся автоматически благодаря onDelete: Cascade)
    await prisma.product.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ message: 'Товар удален' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Ошибка удаления товара' });
  }
};

// Получить товары с низким остатком
const getLowStockProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        stock: {
          lte: prisma.product.fields.min_stock
        }
      },
      include: {
        productCategory: true
      },
      orderBy: { stock: 'asc' }
    });
    
    const formattedProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      article: product.article,
      category: product.category,
      categoryId: product.categoryId,
      cost_price: product.cost_price,
      retail_price: product.retail_price,
      stock: product.stock,
      min_stock: product.min_stock,
      productCategory: product.productCategory
    }));
    
    res.json(formattedProducts);
  } catch (error) {
    console.error('Error getting low stock products:', error);
    res.status(500).json({ message: 'Ошибка загрузки товаров с низким остатком' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts
};