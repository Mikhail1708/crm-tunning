// backend/src/middleware/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';

// Простая валидация email
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
  return emailRegex.test(email);
};

// Санитизация строк (защита от XSS)
export const sanitizeString = (str: string): string => {
  return str
    .replace(/[<>]/g, '') // Удаляем < и >
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Middleware для валидации логина
export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    res.status(400).json({ error: 'Email и пароль обязательны' });
    return;
  }
  
  if (!validateEmail(email)) {
    res.status(400).json({ error: 'Некорректный email' });
    return;
  }
  
  if (password.length < 4) {
    res.status(400).json({ error: 'Пароль должен быть не менее 4 символов' });
    return;
  }
  
  // Санитизация
  req.body.email = email.toLowerCase().trim();
  
  next();
};

// Middleware для валидации товара
export const validateProduct = (req: Request, res: Response, next: NextFunction): void => {
  const { name, article, cost_price, retail_price, stock } = req.body;
  
  if (!name || name.trim().length < 2) {
    res.status(400).json({ error: 'Название товара должно быть не менее 2 символов' });
    return;
  }
  
  if (cost_price === undefined || cost_price < 0) {
    res.status(400).json({ error: 'Себестоимость должна быть положительным числом' });
    return;
  }
  
  if (retail_price === undefined || retail_price < 0) {
    res.status(400).json({ error: 'Розничная цена должна быть положительным числом' });
    return;
  }
  
  if (stock !== undefined && stock < 0) {
    res.status(400).json({ error: 'Остаток не может быть отрицательным' });
    return;
  }
  
  // Санитизация строк
  req.body.name = sanitizeString(name.trim());
  if (article) req.body.article = sanitizeString(article.trim());
  if (req.body.description) req.body.description = sanitizeString(req.body.description);
  
  next();
};

// Middleware для валидации клиента
export const validateClient = (req: Request, res: Response, next: NextFunction): void => {
  const { firstName, phone } = req.body;
  
  if (!firstName || firstName.trim().length < 2) {
    res.status(400).json({ error: 'Имя должно быть не менее 2 символов' });
    return;
  }
  
  if (!phone) {
    res.status(400).json({ error: 'Телефон обязателен' });
    return;
  }
  
  // Простая валидация телефона (цифры, +, пробелы, скобки, дефисы)
  const phoneRegex = /^[\d\s+()-]{10,20}$/;
  if (!phoneRegex.test(phone)) {
    res.status(400).json({ error: 'Некорректный номер телефона' });
    return;
  }
  
  req.body.firstName = sanitizeString(firstName.trim());
  if (req.body.lastName) req.body.lastName = sanitizeString(req.body.lastName);
  if (req.body.city) req.body.city = sanitizeString(req.body.city);
  
  next();
};