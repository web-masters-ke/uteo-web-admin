import api, { unwrap } from '../api';
import { PaginatedResponse } from '../types';

export interface AdminJob {
  id: string;
  title: string;
  status: string;
  jobType: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  description?: string;
  requirements?: string;
  skills?: string[];
  createdAt: string;
  company: { id: string; name: string; isVerified: boolean };
  postedBy: { id: string; email: string };
  _count?: { applications: number };
}

export const jobService = {
  list: async (params?: Record<string, any>): Promise<{ items: AdminJob[]; total: number }> => {
    const p = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    const res = await api.get(`/jobs?${p.toString()}`);
    return unwrap<{ items: AdminJob[]; total: number }>(res);
  },
  get: async (id: string): Promise<AdminJob> => {
    const res = await api.get(`/jobs/${id}`);
    return unwrap<AdminJob>(res);
  },
  updateStatus: async (id: string, status: string): Promise<AdminJob> => {
    const res = await api.patch(`/jobs/${id}`, { status });
    return unwrap<AdminJob>(res);
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/jobs/${id}`);
  },
};
