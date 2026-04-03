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
  const checkRef = useRef<boolean>(false); // предотвращаем двойные запросы

 // frontend/src/contexts/AuthContext.tsx
useEffect(() => {
  let isMounted = true;
  let retryCount = 0;
  const MAX_RETRIES = 1; // только одна попытка
  
  const checkAuth = async () => {
    try {
      const { data } = await apiClient.get('/auth/me', { withCredentials: true });
      if (isMounted) {
        setUser(data);
        setLoading(false);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Не авторизован - просто выходим, без редиректа
        if (isMounted) {
          setUser(null);
          setLoading(false);
          // Не делаем редирект, просто показываем страницу логина
        }
      } else if (retryCount < MAX_RETRIES && error.name !== 'AbortError') {
        retryCount++;
        setTimeout(checkAuth, 1000);
      } else {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      }
    }
  };
  
  checkAuth();
  
  return () => {
    isMounted = false;
  };
}, []);

  const login = async (email: string, password: string) => {
    try {
      const { data } = await apiClient.post('/auth/login', { email, password }, {
        withCredentials: true
      });
      setUser(data.user);
      toast.success('Добро пожаловать!');
      return data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Ошибка входа';
      toast.error(message);
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