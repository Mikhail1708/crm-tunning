// frontend/src/api/client.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Получаем CSRF токен при старте
let csrfToken: string | null = null;

export const fetchCsrfToken = async () => {
  try {
    const response = await axios.get(`${API_URL}/csrf-token`, { withCredentials: true });
    csrfToken = response.data.csrfToken;
    return csrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    return null;
  }
};

// Добавляем CSRF токен в запросы
apiClient.interceptors.request.use(async (config) => {
  // Добавляем CSRF токен для не-GET запросов (кроме auth)
  const isAuthRequest = config.url?.includes('/auth/login') || config.url?.includes('/auth/register');
  
  if (config.method !== 'get' && !isAuthRequest && !config.url?.includes('/csrf-token')) {
    if (!csrfToken) {
      await fetchCsrfToken();
    }
    if (csrfToken && config.headers) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// Интерцептор для обработки ошибок
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 403 && !originalRequest._retry) {
      originalRequest._retry = true;
      await fetchCsrfToken();
      if (csrfToken && originalRequest.headers) {
        originalRequest.headers['X-CSRF-Token'] = csrfToken;
        return apiClient(originalRequest);
      }
    }
    
    return Promise.reject(error);
  }
);

// Экспортируем api объект с методами
export const api = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.get(url, config),
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.post(url, data, config),
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.put(url, data, config),
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.delete(url, config),
};

// Экспортируем сам клиент для прямого использования
export default apiClient;