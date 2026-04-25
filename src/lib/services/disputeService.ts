import api, { unwrap } from '../api';
import { Dispute, PaginatedResponse } from '../types';

export const disputeService = {
  getAll: async (filters: { page?: number; limit?: number; status?: string } = {}): Promise<PaginatedResponse<Dispute>> => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    const res = await api.get(`/disputes?${p.toString()}`);
    return unwrap<PaginatedResponse<Dispute>>(res);
  },

  getById: async (id: string): Promise<Dispute> => {
    const res = await api.get(`/disputes/${id}`);
    return unwrap<Dispute>(res);
  },

  // Backend ResolveDisputeDto expects: { status: DisputeStatus, resolution?: string }
  // status = RESOLVED_RELEASE | RESOLVED_REFUND | CLOSED
  // resolution = free-text explanation
  resolve: async (id: string, disputeStatus: string, resolutionText: string): Promise<Dispute> => {
    const res = await api.patch(`/disputes/${id}/resolve`, { status: disputeStatus, resolution: resolutionText });
    return unwrap<Dispute>(res);
  },

  escalate: async (id: string, note: string, escalateTo?: 'FINANCE_ADMIN' | 'SUPER_ADMIN'): Promise<Dispute> => {
    const res = await api.patch(`/disputes/${id}/escalate`, { note, escalateTo });
    return unwrap<Dispute>(res);
  },

  create: async (data: { bookingId: string; category?: string; reason: string; description?: string }): Promise<Dispute> => {
    const res = await api.post('/disputes', data);
    return unwrap<Dispute>(res);
  },

  assign: async (id: string, assigneeId: string): Promise<Dispute> => {
    const res = await api.patch(`/disputes/${id}/assign`, { assigneeId });
    return unwrap<Dispute>(res);
  },

  unassign: async (id: string): Promise<Dispute> => {
    const res = await api.patch(`/disputes/${id}/unassign`);
    return unwrap<Dispute>(res);
  },

  listComments: async (id: string): Promise<any[]> => {
    const res = await api.get(`/disputes/${id}/comments`);
    return unwrap<any[]>(res);
  },

  addComment: async (id: string, content: string, attachments?: any[], isInternal?: boolean): Promise<any> => {
    const res = await api.post(`/disputes/${id}/comments`, { content, attachments, isInternal });
    return unwrap<any>(res);
  },

  withdraw: async (id: string): Promise<Dispute> => {
    const res = await api.patch(`/disputes/${id}/withdraw`);
    return unwrap<Dispute>(res);
  },

  assignableTeam: async (): Promise<any[]> => {
    const res = await api.get('/disputes/team/assignable');
    return unwrap<any[]>(res);
  },
};
