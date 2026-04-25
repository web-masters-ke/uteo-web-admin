import api, { unwrap } from '../api';
import { Category, TrainerType } from '../types';

export interface CategoryData {
  name: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
  trainerType?: TrainerType;
}

export const categoryService = {
  getAll: async (): Promise<Category[]> => {
    const res = await api.get('/categories');
    const data = unwrap<Category[] | { items: Category[]; total: number }>(res);
    if (Array.isArray(data)) return data;
    return data.items;
  },
  create: async (data: CategoryData): Promise<Category> => { const res = await api.post('/categories', data); return unwrap<Category>(res); },
  update: async (id: string, data: Partial<CategoryData>): Promise<Category> => { const res = await api.patch(`/categories/${id}`, data); return unwrap<Category>(res); },
  delete: async (id: string): Promise<void> => { await api.delete(`/categories/${id}`); },
  toggleActive: async (id: string, isActive: boolean): Promise<Category> => {
    const res = await api.patch(`/categories/${id}`, { isActive });
    return unwrap<Category>(res);
  },
};
