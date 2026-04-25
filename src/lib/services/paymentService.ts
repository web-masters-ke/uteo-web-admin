import api, { unwrap } from '../api';
import { Payment, PaginatedResponse } from '../types';

export interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  completedAmount: number;
  completedCount: number;
  pendingAmount: number;
  pendingCount: number;
  processingAmount: number;
  processingCount: number;
  failedAmount: number;
  failedCount: number;
  refundedAmount: number;
  refundedCount: number;
  byProvider: { provider: string; count: number; amount: number }[];
  byStatus: { status: string; count: number; amount: number }[];
}

export const paymentService = {
  getAll: async (filters: { page?: number; limit?: number; provider?: string; status?: string; startDate?: string; endDate?: string } = {}): Promise<PaginatedResponse<Payment>> => {
    const p = new URLSearchParams(); Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    const res = await api.get(`/payments?${p.toString()}`); return unwrap<PaginatedResponse<Payment>>(res);
  },
  getById: async (id: string): Promise<Payment> => { const res = await api.get(`/payments/${id}`); return unwrap<Payment>(res); },
  getStats: async (): Promise<PaymentStats> => {
    const res = await api.get('/payments/stats');
    const raw = unwrap<any>(res);
    const byStatus: { status: string; count: number; amount: number }[] = (raw.byStatus || []).map((s: any) => ({ status: s.status, count: Number(s.count || 0), amount: Number(s.amount || 0) }));
    const completed = byStatus.find(s => s.status === 'SUCCESS');
    const pending = byStatus.find(s => s.status === 'PENDING');
    const processing = byStatus.find(s => s.status === 'PROCESSING');
    const failed = byStatus.find(s => s.status === 'FAILED');
    const refunded = byStatus.find(s => s.status === 'REFUNDED');
    return {
      totalPayments: Number(raw.total || 0),
      totalAmount: byStatus.reduce((sum, s) => sum + s.amount, 0),
      completedAmount: Number(completed?.amount || raw.totalSuccessful || 0),
      completedCount: Number(completed?.count || 0),
      pendingAmount: Number(pending?.amount || 0),
      pendingCount: Number(pending?.count || 0),
      processingAmount: Number(processing?.amount || 0),
      processingCount: Number(processing?.count || 0),
      failedAmount: Number(failed?.amount || 0),
      failedCount: Number(failed?.count || 0),
      refundedAmount: Number(refunded?.amount || 0),
      refundedCount: Number(refunded?.count || 0),
      byProvider: (raw.byProvider || []).map((p: any) => ({ provider: p.provider, count: Number(p.count || 0), amount: Number(p.amount || 0) })),
      byStatus,
    };
  },
  processPayment: async (id: string): Promise<Payment> => {
    const res = await api.patch(`/payments/${id}`, { status: 'SUCCESS' });
    return unwrap<Payment>(res);
  },
  refundPayment: async (id: string): Promise<Payment> => {
    const res = await api.patch(`/payments/${id}`, { status: 'REFUNDED' });
    return unwrap<Payment>(res);
  },
  failPayment: async (id: string): Promise<Payment> => {
    const res = await api.patch(`/payments/${id}`, { status: 'FAILED' });
    return unwrap<Payment>(res);
  },
  completePayment: async (id: string): Promise<Payment> => {
    const res = await api.patch(`/payments/${id}`, { status: 'SUCCESS' });
    return unwrap<Payment>(res);
  },
};
