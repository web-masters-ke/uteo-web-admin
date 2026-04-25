import api, { unwrap } from '../api';
import { Review, PaginatedResponse } from '../types';

export const reviewService = {
  getAll: async (filters: { page?: number; limit?: number; trainerId?: string; rating?: number; isVisible?: string; search?: string } = {}): Promise<PaginatedResponse<Review>> => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    const res = await api.get(`/reviews?${p.toString()}`);
    return unwrap<PaginatedResponse<Review>>(res);
  },

  getById: async (id: string): Promise<Review> => {
    const res = await api.get(`/reviews/${id}`);
    return unwrap<Review>(res);
  },

  update: async (id: string, data: { rating?: number; comment?: string }): Promise<Review> => {
    const res = await api.patch(`/reviews/${id}`, data);
    return unwrap<Review>(res);
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/reviews/${id}`);
  },

  toggleVisibility: async (id: string, isVisible: boolean): Promise<Review> => {
    if (!isVisible) {
      const res = await api.patch(`/reviews/${id}/hide`);
      return unwrap<Review>(res);
    } else {
      const res = await api.patch(`/reviews/${id}/show`);
      return unwrap<Review>(res);
    }
  },

  getGlobalStats: async (): Promise<{ averageRating: number; totalReviews: number; distribution: Record<number, number> }> => {
    const res = await api.get('/reviews/stats/global');
    return unwrap<{ averageRating: number; totalReviews: number; distribution: Record<number, number> }>(res);
  },
};
