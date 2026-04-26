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

export interface CreateCompanyPayload {
  name: string;
  description?: string;
  industry?: string;
  website?: string;
  logoUrl?: string;
  size?: string;
  location?: string;
  ownerId?: string;
}

export interface RegisterRecruiterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export const companyService = {
  registerRecruiter: async (payload: RegisterRecruiterPayload): Promise<{ id: string; email: string }> => {
    // Role enum only has CLIENT | TRAINER — recruiter relationship is stored in the Recruiter join table
    const res = await api.post('/auth/register', { ...payload, role: 'TRAINER' });
    return unwrap<{ id: string; email: string }>(res);
  },
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
  create: async (payload: CreateCompanyPayload): Promise<AdminCompany> => {
    const res = await api.post('/companies', payload);
    return unwrap<AdminCompany>(res);
  },
  verify: async (id: string, isVerified: boolean): Promise<AdminCompany> => {
    const res = await api.patch(`/companies/${id}`, { isVerified });
    return unwrap<AdminCompany>(res);
  },
  addRecruiter: async (companyId: string, userId: string, title?: string): Promise<void> => {
    await api.post(`/companies/${companyId}/recruiters`, { userId, title });
  },
  removeRecruiter: async (companyId: string, userId: string): Promise<void> => {
    await api.delete(`/companies/${companyId}/recruiters/${userId}`);
  },
};
