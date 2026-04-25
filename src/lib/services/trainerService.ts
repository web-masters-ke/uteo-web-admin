import api, { unwrap } from '../api';
import { Trainer, PaginatedResponse } from '../types';

export interface TrainerFilters {
  page?: number; limit?: number; search?: string; verificationStatus?: string;
  location?: string; county?: string; minRating?: number; maxRating?: number;
  trainerType?: string; tier?: string;
}

export interface UpdateTrainerData {
  bio?: string; hourlyRate?: number; experience?: number; location?: string;
  city?: string; county?: string; specialization?: string; languages?: string[];
  availableForOnline?: boolean; availableForPhysical?: boolean; availableForHybrid?: boolean;
  portfolioUrl?: string; linkedinUrl?: string; websiteUrl?: string;
  skills?: string[];
}

export const trainerService = {
  getAll: async (filters: TrainerFilters = {}): Promise<PaginatedResponse<Trainer>> => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    const res = await api.get(`/trainers?${p.toString()}`);
    return unwrap<PaginatedResponse<Trainer>>(res);
  },

  getById: async (id: string): Promise<Trainer> => {
    const res = await api.get(`/trainers/${id}`);
    return unwrap<Trainer>(res);
  },

  update: async (id: string, data: UpdateTrainerData): Promise<Trainer> => {
    const res = await api.patch(`/trainers/${id}`, data);
    return unwrap<Trainer>(res);
  },

  approve: async (id: string, notes?: string): Promise<Trainer> => {
    const res = await api.post(`/admin/verify-trainer/${id}`, { status: 'VERIFIED', note: notes });
    return unwrap<Trainer>(res);
  },

  reject: async (id: string, notes: string): Promise<Trainer> => {
    const res = await api.post(`/admin/verify-trainer/${id}`, { status: 'REJECTED', note: notes });
    return unwrap<Trainer>(res);
  },

  getStats: async (): Promise<{ total: number; verified: number; pending: number; avgRating: number }> => {
    try {
      const [all, verified, pending] = await Promise.all([
        api.get('/trainers?limit=1'),
        api.get('/trainers?limit=1&verificationStatus=VERIFIED'),
        api.get('/trainers?limit=1&verificationStatus=PENDING'),
      ]);
      const allData = unwrap<PaginatedResponse<Trainer>>(all);
      const verifiedData = unwrap<PaginatedResponse<Trainer>>(verified);
      const pendingData = unwrap<PaginatedResponse<Trainer>>(pending);
      return {
        total: allData.total,
        verified: verifiedData.total,
        pending: pendingData.total,
        avgRating: 0,
      };
    } catch {
      return { total: 0, verified: 0, pending: 0, avgRating: 0 };
    }
  },
};
