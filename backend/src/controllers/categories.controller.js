// backend/src/controllers/categories.controller.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Получить все категории
const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        fields: {
          orderBy: { sortOrder: 'asc' }
        },
        _count: {
          select: { products: true }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ message: 'Ошибка загрузки категорий' });
  }
};

// Получить категорию по ID
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.findUnique({
      where: { id: parseInt(id) },
      include: {
        fields: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error getting category:', error);
    res.status(500).json({ message: 'Ошибка загрузки категории' });
  }
};

// Создать категорию
const createCategory = async (req, res) => {
  try {
    const { name, description, icon, sortOrder } = req.body;
    
    const category = await prisma.category.create({
      data: {
        name,
        description,
        icon,
        sortOrder: sortOrder || 0
      }
    });
    
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Категория с таким названием уже существует' });
    }
    res.status(500).json({ message: 'Ошибка создания категории' });
  }
};

// Обновить категорию
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, sortOrder, isActive } = req.body;
    
    const category = await prisma.category.update({
      where: { id: parseInt(id) },
      data: { 
        name, 
        description, 
        icon, 
        sortOrder, 
        isActive 
      }
    });
    
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Ошибка обновления категории' });
  }
};

// Удалить категорию
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.category.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ message: 'Категория удалена' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Ошибка удаления категории' });
  }
};

// Получить поля категории
const getCategoryFields = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    const fields = await prisma.categoryField.findMany({
      where: { categoryId: parseInt(categoryId) },
      orderBy: { sortOrder: 'asc' }
    });
    
    // Парсим options из JSON
    const fieldsWithOptions = fields.map(field => ({
      ...field,
      options: field.options ? JSON.parse(field.options) : null
    }));
    
    res.json(fieldsWithOptions);
  } catch (error) {
    console.error('Error getting category fields:', error);
    res.status(500).json({ message: 'Ошибка загрузки полей' });
  }
};

// Создать поле для категории
const createCategoryField = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, fieldType, isRequired, sortOrder, options } = req.body;
    
    const field = await prisma.categoryField.create({
      data: {
        categoryId: parseInt(categoryId),
        name,
        fieldType,
        isRequired: isRequired || false,
        sortOrder: sortOrder || 0,
        options: options ? JSON.stringify(options) : null
      }
    });
    
    res.status(201).json(field);
  } catch (error) {
    console.error('Error creating category field:', error);
    res.status(500).json({ message: 'Ошибка создания поля' });
  }
};

// Обновить поле категории
const updateCategoryField = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, fieldType, isRequired, sortOrder, options } = req.body;
    
    const field = await prisma.categoryField.update({
      where: { id: parseInt(id) },
      data: {
        name,
        fieldType,
        isRequired,
        sortOrder,
        options: options ? JSON.stringify(options) : null
      }
    });
    
    res.json(field);
  } catch (error) {
    console.error('Error updating category field:', error);
    res.status(500).json({ message: 'Ошибка обновления поля' });
  }
};

// Удалить поле категории
const deleteCategoryField = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.categoryField.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ message: 'Поле удалено' });
  } catch (error) {
    console.error('Error deleting category field:', error);
    res.status(500).json({ message: 'Ошибка удаления поля' });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryFields,
  createCategoryField,
  updateCategoryField,
  deleteCategoryField
};