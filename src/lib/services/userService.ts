import api, { unwrap } from '../api';
import { User, PaginatedResponse } from '../types';

export interface UserFilters { page?: number; limit?: number; search?: string; role?: string; status?: string; }
export interface CreateUserData { firstName: string; lastName: string; email: string; phone?: string; role: string; password: string; }
export interface UpdateUserData { firstName?: string; lastName?: string; email?: string; phone?: string; role?: string; status?: string; }

export const userService = {
  getAll: async (filters: UserFilters = {}): Promise<PaginatedResponse<User>> => {
    const p = new URLSearchParams(); Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    const res = await api.get(`/users?${p.toString()}`); return unwrap<PaginatedResponse<User>>(res);
  },
  getById: async (id: string): Promise<User> => { const res = await api.get(`/users/${id}`); return unwrap<User>(res); },
  create: async (data: CreateUserData): Promise<User> => { const res = await api.post('/users', data); return unwrap<User>(res); },
  update: async (id: string, data: UpdateUserData): Promise<User> => { const res = await api.patch(`/users/${id}`, data); return unwrap<User>(res); },
  delete: async (id: string): Promise<void> => { await api.delete(`/users/${id}`); },
  suspend: async (id: string): Promise<User> => { const res = await api.patch(`/users/${id}/status`, { status: 'SUSPENDED' }); return unwrap<User>(res); },
  activate: async (id: string): Promise<User> => { const res = await api.patch(`/users/${id}/status`, { status: 'ACTIVE' }); return unwrap<User>(res); },
};
