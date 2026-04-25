import api, { unwrap } from '../api';
import { Notification, PaginatedResponse } from '../types';

export const notificationService = {
  getAll: async (filters: { page?: number; limit?: number; channel?: string; status?: string } = {}): Promise<PaginatedResponse<Notification>> => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    const res = await api.get(`/notifications?${p.toString()}`);
    return unwrap<PaginatedResponse<Notification>>(res);
  },

  send: async (data: { userId?: string; channel: string; title: string; message: string }): Promise<Notification> => {
    const res = await api.post('/notifications/send', data);
    return unwrap<Notification>(res);
  },

  sendBulk: async (data: { role: string; channel: string; title: string; message: string }): Promise<{ count: number }> => {
    const res = await api.post('/notifications/send-bulk', data);
    return unwrap<{ count: number }>(res);
  },
};
