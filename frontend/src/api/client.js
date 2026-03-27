// frontend/src/api/client.js
import axios from 'axios';

// Определяем API URL автоматически с диагностикой
const getApiUrl = () => {
  // Если в .env задан URL, используем его
  if (import.meta.env.VITE_API_URL) {
    console.log('📦 Using VITE_API_URL from env:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }
  
  // Определяем по текущему хосту
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  console.log('🌐 Current hostname:', hostname);
  console.log('🔌 Current protocol:', protocol);
  
  // Список известных IP адресов
  const knownIps = ['10.50.85.247', '192.168.2.27'];
  
  // Если это известный IP из сети
  if (knownIps.includes(hostname)) {
    const url = `http://${hostname}:5000/api`;
    console.log('🏠 Using known IP:', url);
    return url;
  }
  
  // Если это локальная сеть (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  if (hostname.match(/^(10\.|192\.168|172\.(1[6-9]|2[0-9]|3[0-1]))/)) {
    const url = `http://${hostname}:5000/api`;
    console.log('🌍 Using local network IP:', url);
    return url;
  }
  
  // Если localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('💻 Using localhost');
    return 'http://localhost:5000/api';
  }
  
  // Если это доменное имя (прод)
  if (!hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    // Для прод-сервера, если фронтенд и бэкенд на одном домене
    const url = `${protocol}//${hostname}:5000/api`;
    console.log('☁️ Using domain name:', url);
    return url;
  }
  
  // По умолчанию используем статический IP
  const defaultUrl = 'http://10.50.85.247:5000/api';
  console.log('⚠️ Using default IP:', defaultUrl);
  return defaultUrl;
};

const API_URL = getApiUrl();

// Создаем клиент с увеличенным таймаутом для продакшена
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 секунд таймаут
});

// Добавляем токен к каждому запросу
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Добавляем параметр для отключения кэша в продакшене
    if (import.meta.env.PROD) {
      config.params = {
        ...config.params,
        _t: Date.now()
      };
    }
    
    console.log(`🚀 ${config.method.toUpperCase()} ${config.url}`, config.params);
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Обработка ошибок с диагностикой
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.config.url}`, response.status);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('❌ Response error:', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url
      });
      
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    } else if (error.request) {
      console.error('❌ No response:', {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL
      });
      
      // Показываем более информативное сообщение об ошибке
      const errorMessage = `Не удалось подключиться к серверу (${API_URL}). Проверьте, запущен ли бэкенд.`;
      console.error(errorMessage);
      
      // В продакшене можно показать уведомление
      if (import.meta.env.PROD) {
        // Здесь можно добавить toast уведомление
        console.warn('⚠️ Сервер недоступен. Проверьте подключение.');
      }
    } else {
      console.error('❌ Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Функция для проверки подключения к серверу
export const checkServerConnection = async () => {
  try {
    const response = await apiClient.get('/health');
    console.log('✅ Server connection OK:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Server connection failed:', error.message);
    return false;
  }
};

export default apiClient;