import api, { unwrap } from '../api';

export interface AdminApplication {
  id: string;
  status: string;
  appliedAt: string;
  coverLetter?: string;
  user: { id: string; email: string; firstName?: string; lastName?: string };
  job: { id: string; title: string; company: { name: string } };
}

export const applicationAdminService = {
  list: async (params?: Record<string, any>): Promise<{ items: AdminApplication[]; total: number }> => {
    const p = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    const res = await api.get(`/applications?${p.toString()}`);
    return unwrap<{ items: AdminApplication[]; total: number }>(res);
  },
  get: async (id: string): Promise<AdminApplication> => {
    const res = await api.get(`/applications/${id}`);
    return unwrap<AdminApplication>(res);
  },
};
