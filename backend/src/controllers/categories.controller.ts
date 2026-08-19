// backend/src/controllers/categories.controller.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { RequestWithUser, CreateCategoryDTO, CreateCategoryFieldDTO } from '../types';

const prisma = new PrismaClient();
export const getCategories = async (req: RequestWithUser, res: Response): Promise<void> => {
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

export const getCategoryById = async (req: RequestWithUser, res: Response): Promise<void> => {
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
      res.status(404).json({ message: 'Категория не найдена' });
      return;
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error getting category:', error);
    res.status(500).json({ message: 'Ошибка загрузки категории' });
  }
};

export const createCategory = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const data: CreateCategoryDTO = req.body;
    const { name, description, icon, sortOrder } = data;
    
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
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      res.status(400).json({ message: 'Категория с таким названием уже существует' });
      return;
    }
    res.status(500).json({ message: 'Ошибка создания категории' });
  }
};

export const updateCategory = async (req: RequestWithUser, res: Response): Promise<void> => {
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

export const deleteCategory = async (req: RequestWithUser, res: Response): Promise<void> => {
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
export const getCategoryFields = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.params;
    
    const fields = await prisma.categoryField.findMany({
      where: { categoryId: parseInt(categoryId) },
      orderBy: { sortOrder: 'asc' }
    });
    
    // Исправлено: добавляем тип для параметра field
    const fieldsWithOptions = fields.map((field: any) => ({
      ...field,
      options: field.options ? JSON.parse(field.options) : null
    }));
    
    res.json(fieldsWithOptions);
  } catch (error) {
    console.error('Error getting category fields:', error);
    res.status(500).json({ message: 'Ошибка загрузки полей' });
  }
};
export const createCategoryField = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.params;
    const data: CreateCategoryFieldDTO = req.body;
    const { name, fieldType, isRequired, sortOrder, options } = data;
    
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

export const updateCategoryField = async (req: RequestWithUser, res: Response): Promise<void> => {
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

export const deleteCategoryField = async (req: RequestWithUser, res: Response): Promise<void> => {
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