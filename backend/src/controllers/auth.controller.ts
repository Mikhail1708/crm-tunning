// backend/src/controllers/auth.controller.ts (CRM)
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RequestWithUser } from '../types';

const prisma = new PrismaClient();

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

interface LoginBody {
  email: string;
  password: string;
}

export const register = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { email, password, name }: RegisterBody = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      return;
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: { 
        email, 
        password: hashedPassword, 
        name, 
        role: 'manager'
      },
      select: { 
        id: true, 
        email: true, 
        name: true, 
        role: true, 
        createdAt: true 
      }
    });
    
    res.status(201).json({ message: 'Пользователь успешно зарегистрирован', user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Ошибка при регистрации' });
  }
};

export const login = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginBody = req.body;
    
    console.log('Login attempt:', email);
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }
    
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    
    console.log('Token generated, setting cookie...');
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
    
    console.log('Cookie set, sending response');
    
    res.json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка при входе' });
  }
};

export const logout = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.json({ message: 'Выход выполнен успешно' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Ошибка при выходе' });
  }
};

// ============================================================
// ✅ ИСПРАВЛЕННЫЙ getMe — ИЩЕМ ПО EMAIL
// ============================================================
export const getMe = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    console.log('getMe called, req.user:', req.user);
    
    if (!req.user) {
      console.log('No user in request, sending 401');
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    
    // ✅ ИЩЕМ ПО EMAIL (не по ID)
    const user = await prisma.user.findUnique({
      where: { email: req.user.email },
      select: { 
        id: true, 
        email: true, 
        name: true, 
        role: true, 
        createdAt: true 
      }
    });
    
    if (!user) {
      console.log('User not found by email:', req.user.email);
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    
    console.log('User found:', user.email);
    res.json(user);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
};
