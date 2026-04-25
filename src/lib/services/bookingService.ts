import api, { unwrap } from '../api';
import { Booking, PaginatedResponse } from '../types';

export interface BookingFilters { page?: number; limit?: number; search?: string; status?: string; sessionType?: string; trainerId?: string; clientId?: string; startDate?: string; endDate?: string; dateFrom?: string; dateTo?: string; }

export const bookingService = {
  getAll: async (filters: BookingFilters = {}): Promise<PaginatedResponse<Booking>> => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') {
        // Map frontend param names to backend param names
        const key = k === 'startDate' ? 'dateFrom' : k === 'endDate' ? 'dateTo' : k;
        p.set(key, String(v));
      }
    });
    const res = await api.get(`/bookings?${p.toString()}`); return unwrap<PaginatedResponse<Booking>>(res);
  },
  getById: async (id: string): Promise<Booking> => { const res = await api.get(`/bookings/${id}`); return unwrap<Booking>(res); },
  create: async (data: Record<string, unknown>): Promise<Booking> => { const res = await api.post('/bookings', data); return unwrap<Booking>(res); },
  confirm: async (id: string): Promise<Booking> => { const res = await api.patch(`/bookings/${id}/status`, { status: 'CONFIRMED' }); return unwrap<Booking>(res); },
  cancel: async (id: string, reason?: string): Promise<Booking> => { const res = await api.patch(`/bookings/${id}/status`, { status: 'CANCELLED', reason }); return unwrap<Booking>(res); },
  complete: async (id: string): Promise<Booking> => { const res = await api.patch(`/bookings/${id}/status`, { status: 'COMPLETED' }); return unwrap<Booking>(res); },
  dispute: async (id: string, reason: string): Promise<Booking> => { const res = await api.patch(`/bookings/${id}/status`, { status: 'DISPUTED', reason }); return unwrap<Booking>(res); },
};
