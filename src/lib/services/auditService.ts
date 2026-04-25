import api, { unwrap } from '../api';
import { AuditLog, PaginatedResponse } from '../types';

export const auditService = {
  getAll: async (filters: { page?: number; limit?: number; userId?: string; action?: string; resource?: string; startDate?: string; endDate?: string; search?: string } = {}): Promise<PaginatedResponse<AuditLog>> => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    const res = await api.get(`/admin/audit-logs?${p.toString()}`);
    return unwrap<PaginatedResponse<AuditLog>>(res);
  },
};
