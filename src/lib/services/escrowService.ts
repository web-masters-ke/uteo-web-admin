import api, { unwrap } from '../api';
import { Escrow, PaginatedResponse } from '../types';

export const escrowService = {
  getById: async (id: string): Promise<Escrow> => { const res = await api.get(`/escrow/${id}`); return unwrap<Escrow>(res); },
  getByBooking: async (bookingId: string): Promise<Escrow> => { const res = await api.get(`/escrow/booking/${bookingId}`); return unwrap<Escrow>(res); },
  release: async (bookingId: string): Promise<Escrow> => { const res = await api.post('/escrow/release', { bookingId }); return unwrap<Escrow>(res); },
  refund: async (bookingId: string): Promise<Escrow> => { const res = await api.post('/escrow/refund', { bookingId }); return unwrap<Escrow>(res); },
  freeze: async (bookingId: string): Promise<Escrow> => { const res = await api.post('/escrow/freeze', { bookingId }); return unwrap<Escrow>(res); },
};
