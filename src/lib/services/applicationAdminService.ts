import api, { unwrap } from '../api';

export interface AdminApplication {
  id: string;
  status: string;
  appliedAt: string;
  updatedAt: string;
  coverLetter?: string;
  resumeUrl?: string;
  notes?: string;
  scheduledAt?: string;
  meetingLink?: string;
  user: { id: string; email: string; firstName?: string; lastName?: string; avatar?: string };
  job: {
    id: string;
    title: string;
    jobType?: string;
    location?: string;
    company: { id: string; name: string; logoUrl?: string };
  };
}

export interface UpdateApplicationStatusPayload {
  status: string;
  notes?: string;
  scheduledAt?: string;
  meetingLink?: string;
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
  updateStatus: async (id: string, payload: UpdateApplicationStatusPayload): Promise<AdminApplication> => {
    const res = await api.patch(`/applications/${id}/status`, payload);
    return unwrap<AdminApplication>(res);
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/applications/${id}`);
  },
};
