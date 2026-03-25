// frontend/src/api/client.js
import axios from 'axios';

// Определяем API URL автоматически
const getApiUrl = () => {
  // Если в .env задан URL, используем его
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Определяем по текущему хосту
  const hostname = window.location.hostname;
  
  // Список известных IP адресов
  const knownIps = ['10.50.85.247', '192.168.2.27'];
  
  // Если это известный IP из сети или интернета
  if (knownIps.includes(hostname) || hostname.match(/^(10\.|192\.168|172\.(1[6-9]|2[0-9]|3[0-1]))/)) {
    return `http://${hostname}:5000/api`;
  }
  
  // Если localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }
  
  // По умолчанию используем статический IP
  return 'http://10.50.85.247:5000/api';
};

const API_URL = getApiUrl();

console.log('🔧 API URL:', API_URL); // Для отладки

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем токен к каждому запросу
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Обработка ошибок
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;