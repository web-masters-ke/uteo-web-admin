import api, { unwrap } from '../api';
import { VerificationRequest, PaginatedResponse } from '../types';

export const verificationService = {
  getAll: async (filters: { page?: number; limit?: number; status?: string } = {}): Promise<PaginatedResponse<VerificationRequest>> => {
    const p = new URLSearchParams(); Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    const res = await api.get(`/verification/requests?${p.toString()}`); return unwrap<PaginatedResponse<VerificationRequest>>(res);
  },
  approve: async (id: string, notes?: string): Promise<VerificationRequest> => { const res = await api.patch(`/verification/requests/${id}`, { status: 'APPROVED', reviewNote: notes }); return unwrap<VerificationRequest>(res); },
  reject: async (id: string, notes: string): Promise<VerificationRequest> => { const res = await api.patch(`/verification/requests/${id}`, { status: 'REJECTED', reviewNote: notes }); return unwrap<VerificationRequest>(res); },
};
