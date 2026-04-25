import api, { unwrap } from '../api';

export interface AdminCompany {
  id: string;
  name: string;
  industry?: string;
  size: string;
  location?: string;
  website?: string;
  description?: string;
  logoUrl?: string;
  isVerified: boolean;
  createdAt: string;
  _count?: { jobs: number; recruiters: number };
}

export interface AdminRecruiter {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

export const companyService = {
  list: async (params?: Record<string, any>): Promise<{ items: AdminCompany[]; total: number }> => {
    const p = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    const res = await api.get(`/companies?${p.toString()}`);
    return unwrap<{ items: AdminCompany[]; total: number }>(res);
  },
  get: async (id: string): Promise<AdminCompany> => {
    const res = await api.get(`/companies/${id}`);
    return unwrap<AdminCompany>(res);
  },
  verify: async (id: string, isVerified: boolean): Promise<AdminCompany> => {
    const res = await api.patch(`/companies/${id}`, { isVerified });
    return unwrap<AdminCompany>(res);
  },
};
