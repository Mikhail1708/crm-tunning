import { Request, Response, NextFunction } from 'express';
import { validationResult, body, param, query } from 'express-validator';

// Обработчик ошибок валидации
export const validationErrorHandler = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array() 
    });
    return;
  }
  next();
};

// Валидация ID
export const validateId = (paramName: string = 'id') => [
  param(paramName).isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validationErrorHandler
];

// Валидация пагинации
export const validatePagination = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validationErrorHandler
];

// Валидация телефона
export const validatePhone = (field: string = 'phone') => [
  body(field).optional().matches(/^(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/).withMessage('Invalid phone format'),
  validationErrorHandler
];

// Валидация email
export const validateEmail = (field: string = 'email') => [
  body(field).optional().isEmail().withMessage('Invalid email format'),
  validationErrorHandler
];

// Валидация скидки
export const validateDiscount = (field: string = 'discountPercent') => [
  body(field).optional().isInt({ min: 0, max: 100 }).withMessage('Discount must be between 0 and 100'),
  validationErrorHandler
];