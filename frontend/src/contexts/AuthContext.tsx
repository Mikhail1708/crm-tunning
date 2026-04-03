// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import toast from 'react-hot-toast';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'manager';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const initialCheckDone = useRef<boolean>(false);

  useEffect(() => {
    if (initialCheckDone.current) return;
    initialCheckDone.current = true;
    
    const checkAuth = async () => {
      try {
        console.log('Checking auth status...');
        const { data } = await apiClient.get('/auth/me', { 
          withCredentials: true,
          timeout: 10000
        });
        setUser(data);
        console.log('Auth check successful:', data?.email);
      } catch (error: any) {
        if (error.response?.status === 429) {
          console.warn('Rate limited (429), stopping auth checks');
          setUser(null);
        } else if (error.response?.status === 401) {
          console.log('Not authenticated (401)');
          setUser(null);
        } else {
          console.error('Auth check error:', error.message);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('Logging in...');
      const { data } = await apiClient.post('/auth/login', { email, password }, {
        withCredentials: true,
        timeout: 15000
      });
      setUser(data.user);
      toast.success('Добро пожаловать!');
      return data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        toast.error('Слишком много попыток входа. Подождите 15 минут');
        console.error('Rate limited on login');
      } else if (error.response?.status === 401) {
        toast.error('Неверный email или пароль');
      } else {
        toast.error(error.response?.data?.message || error.response?.data?.error || 'Ошибка входа');
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout', {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      toast.success('Выход выполнен');
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};