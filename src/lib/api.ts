import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiEnvelope } from './types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('skillsasa-admin-token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/');
      if (!isAuthEndpoint && typeof window !== 'undefined') {
        localStorage.removeItem('skillsasa-admin-token');
        localStorage.removeItem('skillsasa-admin-user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function unwrap<T>(response: { data: ApiEnvelope<T> }): T {
  return response.data.data;
}

export default api;
