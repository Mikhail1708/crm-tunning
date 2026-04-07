// frontend/src/api/client.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Перехватчик запросов
api.interceptors.request.use(
  (config) => {
    // Закомментировано для отключения логов
    // console.log('Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Перехватчик ответов
api.interceptors.response.use(
  (response) => {
    // Закомментировано для отключения логов
    // console.log('Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('Response error:', error.response.status, error.response.config.url, error.response.data);
    } else if (error.request) {
      console.error('No response:', error.request);
    } else {
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Добавляем default export для совместимости с импортами
export default api;