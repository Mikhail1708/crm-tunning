// frontend/src/api/auth.ts
import { api } from './client';
import { User, ApiResponse } from '../types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'manager';
}

export const authApi = {
  login: (data: LoginRequest): Promise<ApiResponse<LoginResponse>> =>
    api.post('/auth/login', data),
  
  register: (data: RegisterRequest): Promise<ApiResponse<User>> =>
    api.post('/auth/register', data),
  
  getMe: (): Promise<ApiResponse<User>> =>
    api.get('/auth/me'),
};