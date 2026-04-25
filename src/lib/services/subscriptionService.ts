import api, { unwrap } from '../api';
import { SubscriptionPlan, Subscription, PaginatedResponse } from '../types';

export interface PlanData {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  durationDays: number;
  billingCycle?: string;
  features?: Record<string, any> | string[];
  maxBookings?: number | null;
  maxTeamMembers?: number | null;
  commissionRate?: number | null;
  trainerType?: string | null;
  isActive?: boolean;
  isGlobal?: boolean;
  orgId?: string | null;
  sortOrder?: number;
}

export interface SubscriptionStats {
  totalActive: number;
  totalPlans: number;
  activePlans: number;
  mrr: number;
  expiringSoon: number;
  revenueByPlan: Array<{
    planName: string;
    planId: string;
    price: number;
    billingCycle: string;
    subscriberCount: number;
    totalRevenue: number;
  }>;
  byTrainerType: Array<{ trainerType: string; count: number }>;
}

export const subscriptionService = {
  getPlans: async (): Promise<SubscriptionPlan[]> => {
    const res = await api.get('/subscriptions/plans');
    const data = unwrap<SubscriptionPlan[] | { items: SubscriptionPlan[]; total: number }>(res);
    if (Array.isArray(data)) return data;
    return data.items;
  },

  getAllPlans: async (): Promise<SubscriptionPlan[]> => {
    const res = await api.get('/subscriptions/plans/all');
    const data = unwrap<SubscriptionPlan[] | { items: SubscriptionPlan[]; total: number }>(res);
    if (Array.isArray(data)) return data;
    return data.items;
  },

  getOrgPlans: async (orgId: string): Promise<SubscriptionPlan[]> => {
    const res = await api.get(`/subscriptions/plans/org/${orgId}`);
    const data = unwrap<SubscriptionPlan[]>(res);
    return Array.isArray(data) ? data : [];
  },

  createPlan: async (data: PlanData): Promise<SubscriptionPlan> => {
    const res = await api.post('/subscriptions/plans', data);
    return unwrap<SubscriptionPlan>(res);
  },

  createOrgPlan: async (orgId: string, data: PlanData): Promise<SubscriptionPlan> => {
    const res = await api.post(`/subscriptions/plans/org/${orgId}`, data);
    return unwrap<SubscriptionPlan>(res);
  },

  updatePlan: async (id: string, data: Partial<PlanData>): Promise<SubscriptionPlan> => {
    const res = await api.patch(`/subscriptions/plans/${id}`, data);
    return unwrap<SubscriptionPlan>(res);
  },

  deletePlan: async (id: string): Promise<void> => {
    await api.delete(`/subscriptions/plans/${id}`);
  },

  togglePlan: async (id: string): Promise<SubscriptionPlan> => {
    const res = await api.patch(`/subscriptions/plans/${id}/toggle`);
    return unwrap<SubscriptionPlan>(res);
  },

  duplicatePlan: async (id: string, overrides?: { orgId?: string; name?: string }): Promise<SubscriptionPlan> => {
    const res = await api.post(`/subscriptions/plans/${id}/duplicate`, overrides || {});
    return unwrap<SubscriptionPlan>(res);
  },

  getStats: async (): Promise<SubscriptionStats> => {
    const res = await api.get('/subscriptions/stats');
    return unwrap<SubscriptionStats>(res);
  },

  getSubscriptions: async (params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<Subscription>> => {
    const p = new URLSearchParams();
    if (params?.page) p.set('page', String(params.page));
    if (params?.limit) p.set('limit', String(params.limit));
    if (params?.status) p.set('status', params.status);
    const res = await api.get(`/subscriptions?${p.toString()}`);
    return unwrap<PaginatedResponse<Subscription>>(res);
  },
};
