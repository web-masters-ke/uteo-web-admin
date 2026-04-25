import api, { unwrap } from '../api';

function qs(params?: Record<string, any>): string {
  const sp = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') sp.set(k, String(v)); });
  return sp.toString();
}

export const financialService = {
  // Platform reports
  platformSummary: async (period?: string) => {
    const res = await api.get(`/reports/platform/summary${period ? `?period=${period}` : ''}`);
    return unwrap<any>(res);
  },
  platformRevenue: async (period?: string, groupBy?: string) => {
    const q = qs({ period, groupBy });
    const res = await api.get(`/reports/platform/revenue${q ? `?${q}` : ''}`);
    return unwrap<any>(res);
  },
  platformCommissions: async (period?: string) => {
    const res = await api.get(`/reports/platform/commissions${period ? `?period=${period}` : ''}`);
    return unwrap<any>(res);
  },
  platformPayouts: async (period?: string) => {
    const res = await api.get(`/reports/platform/payouts${period ? `?period=${period}` : ''}`);
    return unwrap<any>(res);
  },
  platformSubscriptions: async () => {
    const res = await api.get('/reports/platform/subscriptions');
    return unwrap<any>(res);
  },

  // Payouts admin
  payoutQueue: async (params?: Record<string, any>) => {
    const q = qs(params);
    const res = await api.get(`/payouts/admin/queue${q ? `?${q}` : ''}`);
    return unwrap<any>(res);
  },
  payoutStats: async () => {
    const res = await api.get('/payouts/admin/stats');
    return unwrap<any>(res);
  },
  approvePayout: async (id: string) => {
    const res = await api.patch(`/payouts/${id}/approve`);
    return unwrap<any>(res);
  },
  processPayout: async (id: string) => {
    const res = await api.patch(`/payouts/${id}/process`);
    return unwrap<any>(res);
  },
  completePayout: async (id: string, reference: string) => {
    const res = await api.patch(`/payouts/${id}/complete`, { reference });
    return unwrap<any>(res);
  },
  rejectPayout: async (id: string, reason: string) => {
    const res = await api.patch(`/payouts/${id}/reject`, { reason });
    return unwrap<any>(res);
  },

  // Platform wallet & money flow
  platformWallet: async () => {
    const res = await api.get('/reports/platform/wallet');
    return unwrap<any>(res);
  },
  platformMoneyFlow: async () => {
    const res = await api.get('/reports/platform/money-flow');
    return unwrap<any>(res);
  },

  // Invoices admin
  allInvoices: async (params?: Record<string, any>) => {
    const q = qs(params);
    const res = await api.get(`/invoices/admin/all${q ? `?${q}` : ''}`);
    return unwrap<any>(res);
  },
  invoiceStats: async () => {
    const res = await api.get('/invoices/stats');
    return unwrap<any>(res);
  },
  getInvoice: async (id: string) => {
    const res = await api.get(`/invoices/${id}`);
    return unwrap<any>(res);
  },
  createInvoice: async (data: Record<string, any>) => {
    const res = await api.post('/invoices', data);
    return unwrap<any>(res);
  },
  autoGenerateInvoice: async (bookingId: string) => {
    const res = await api.post(`/invoices/auto/${bookingId}`);
    return unwrap<any>(res);
  },
  sendInvoice: async (id: string) => {
    const res = await api.patch(`/invoices/${id}/send`);
    return unwrap<any>(res);
  },
  markInvoicePaid: async (id: string) => {
    const res = await api.patch(`/invoices/${id}/paid`);
    return unwrap<any>(res);
  },
  voidInvoice: async (id: string) => {
    const res = await api.patch(`/invoices/${id}/void`);
    return unwrap<any>(res);
  },
};
