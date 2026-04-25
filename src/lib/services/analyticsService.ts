import api, { unwrap } from '../api';

export interface AdminDashboardData {
  totalUsers: number;
  totalTrainers: number;
  verifiedTrainers: number;
  totalBookings: number;
  completedBookings: number;
  activeEscrows: number;
  totalRevenue: number | string;
  recentSignups: number;
  activeSubscriptions: number;
  activeDisputes?: number;
  pendingVerifications?: number;
}

export interface AnalyticsData {
  dateRange: { from: string; to: string };
  bookingsPerDay: { date: string; total: number; count: number }[];
  signupsPerDay: { date: string; total: number; count: number }[];
  revenuePerDay: { date: string; total: number; count: number }[];
}

export interface TopTrainer {
  id: string;
  name: string;
  email: string;
  totalBookings: number;
  totalRevenue: number;
  averageRating: number;
  completedSessions: number;
}

export interface CategoryBreakdown {
  name: string;
  bookings: number;
  revenue: number;
  trainers: number;
}

export const analyticsService = {
  getDashboard: async (): Promise<AdminDashboardData> => {
    const res = await api.get('/admin/dashboard');
    return unwrap<AdminDashboardData>(res);
  },
  getAnalytics: async (dateFrom?: string, dateTo?: string, days?: number): Promise<AnalyticsData> => {
    const p = new URLSearchParams();
    if (days && !dateFrom && !dateTo) {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - days);
      p.set('dateFrom', from.toISOString().split('T')[0]);
      p.set('dateTo', to.toISOString().split('T')[0]);
    } else {
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo) p.set('dateTo', dateTo);
    }
    const res = await api.get(`/admin/analytics?${p.toString()}`);
    return unwrap<AnalyticsData>(res);
  },
  overview: async () => {
    const res = await api.get('/analytics/overview');
    return unwrap<any>(res);
  },
  revenue: async (period?: string) => {
    const res = await api.get(`/analytics/revenue${period ? `?period=${period}` : ''}`);
    return unwrap<any>(res);
  },
  bookings: async (period?: string) => {
    const res = await api.get(`/analytics/bookings${period ? `?period=${period}` : ''}`);
    return unwrap<any>(res);
  },
  users: async (period?: string) => {
    const res = await api.get(`/analytics/users${period ? `?period=${period}` : ''}`);
    return unwrap<any>(res);
  },
  topTrainers: async (limit?: number): Promise<TopTrainer[]> => {
    const res = await api.get(`/analytics/top-trainers${limit ? `?limit=${limit}` : ''}`);
    return unwrap<TopTrainer[]>(res);
  },
  categories: async (): Promise<CategoryBreakdown[]> => {
    const res = await api.get('/analytics/categories');
    return unwrap<CategoryBreakdown[]>(res);
  },
};
