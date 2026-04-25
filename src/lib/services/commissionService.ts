import api, { unwrap } from '../api';
import { CommissionRule, CommissionRecord, PaginatedResponse } from '../types';

export interface CommissionRuleData {
  name: string;
  minAmount: number;
  maxAmount: number;
  commissionRate: number;
  subscriptionTier?: string;
  trainerType?: string;
  orgId?: string;
  isActive: boolean;
}

export interface CommissionAnalytics {
  revenueTrend: { date: string; value: number }[];
  byTrainerType: { name: string; value: number }[];
  topEarners: { name: string; trainerType?: string; commissionTotal: number; bookingCount: number }[];
  effectiveRateTrend: { date: string; value: number }[];
}

export interface TrainerCommissionListItem {
  trainerId: string;
  trainerName: string;
  trainerEmail: string;
  trainerType: string | null;
  orgId: string | null;
  orgName: string | null;
  customRate: number | null;
  commissionWaivedUntil: string | null;
  isWaived: boolean;
  effectiveRate: number;
  rateSource: string;
  subscriptionPlan: string | null;
  hasOverride?: boolean;
  override?: {
    id: string;
    customRate: number;
    reason: string | null;
    validUntil: string | null;
    createdAt: string;
  } | null;
}

export interface TrainerCommissionDetail extends TrainerCommissionListItem {
  ruleId: string | null;
  recentRecords: {
    id: string;
    bookingAmount: number;
    commissionRate: number;
    commissionAmount: number;
    trainerPayoutAmount: number;
    ruleName: string | null;
    createdAt: string;
  }[];
}

export interface CommissionOverrideItem {
  id: string;
  trainerId: string;
  orgId: string | null;
  customRate: number;
  reason: string | null;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  trainerName: string | null;
  trainerEmail: string | null;
}

export interface TrainerRateItem {
  trainerId: string;
  trainerName: string;
  avatar: string | null;
  trainerType: string;
  rating: number;
  effectiveRate: number;
  rateSource: string;
  hasOverride: boolean;
  override: {
    id: string;
    customRate: number;
    reason: string | null;
    validUntil: string | null;
    createdAt: string;
  } | null;
}

export const commissionService = {
  getRules: async (): Promise<CommissionRule[]> => {
    const res = await api.get('/commissions/rules');
    const data = unwrap<CommissionRule[] | { items: CommissionRule[]; total: number }>(res);
    if (Array.isArray(data)) return data;
    return data.items;
  },

  createRule: async (data: CommissionRuleData): Promise<CommissionRule> => {
    const res = await api.post('/commissions/rules', data);
    return unwrap<CommissionRule>(res);
  },

  updateRule: async (id: string, data: Partial<CommissionRuleData>): Promise<CommissionRule> => {
    const res = await api.patch(`/commissions/rules/${id}`, data);
    return unwrap<CommissionRule>(res);
  },

  deleteRule: async (id: string): Promise<void> => {
    await api.delete(`/commissions/rules/${id}`);
  },

  toggleRule: async (id: string, isActive: boolean): Promise<CommissionRule> => {
    const res = await api.patch(`/commissions/rules/${id}`, { isActive });
    return unwrap<CommissionRule>(res);
  },

  getRecords: async (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    trainerSearch?: string;
    minAmount?: number;
    maxAmount?: number;
  }): Promise<PaginatedResponse<CommissionRecord>> => {
    const p = new URLSearchParams();
    if (params?.page) p.set('page', String(params.page));
    if (params?.limit) p.set('limit', String(params.limit));
    if (params?.startDate) p.set('startDate', params.startDate);
    if (params?.endDate) p.set('endDate', params.endDate);
    if (params?.trainerSearch) p.set('trainerSearch', params.trainerSearch);
    if (params?.minAmount) p.set('minAmount', String(params.minAmount));
    if (params?.maxAmount) p.set('maxAmount', String(params.maxAmount));
    const res = await api.get(`/commissions/records?${p.toString()}`);
    return unwrap<PaginatedResponse<CommissionRecord>>(res);
  },

  getStats: async (): Promise<{
    totalCommission: number;
    totalRecords: number;
    averageRate: number;
    thisMonth: number;
    last30Days: { commission: number; count: number };
  }> => {
    const res = await api.get('/commissions/stats');
    return unwrap(res);
  },

  getAnalytics: async (): Promise<CommissionAnalytics> => {
    const res = await api.get('/commissions/analytics');
    const data = unwrap<any>(res);
    return {
      revenueTrend: Array.isArray(data?.revenueTrend) ? data.revenueTrend : [],
      byTrainerType: Array.isArray(data?.byTrainerType) ? data.byTrainerType : [],
      topEarners: Array.isArray(data?.topEarners) ? data.topEarners : [],
      effectiveRateTrend: Array.isArray(data?.effectiveRateTrend) ? data.effectiveRateTrend : [],
    };
  },

  /* ─── Trainer-level commission management ──────────────────────────────── */

  listTrainersWithCommission: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<TrainerCommissionListItem>> => {
    const p = new URLSearchParams();
    if (params?.search) p.set('search', params.search);
    if (params?.page) p.set('page', String(params.page));
    if (params?.limit) p.set('limit', String(params.limit));
    const res = await api.get(`/commissions/trainers?${p.toString()}`);
    return unwrap<PaginatedResponse<TrainerCommissionListItem>>(res);
  },

  getTrainerCommission: async (trainerId: string): Promise<TrainerCommissionDetail> => {
    const res = await api.get(`/commissions/trainer/${trainerId}`);
    return unwrap<TrainerCommissionDetail>(res);
  },

  setTrainerRate: async (trainerId: string, rate: number) => {
    const res = await api.patch(`/commissions/trainer/${trainerId}/rate`, { rate });
    return unwrap(res);
  },

  waiveTrainer: async (trainerId: string, until: string) => {
    const res = await api.patch(`/commissions/trainer/${trainerId}/waive`, { until });
    return unwrap(res);
  },

  removeTrainerRate: async (trainerId: string) => {
    const res = await api.delete(`/commissions/trainer/${trainerId}/rate`);
    return unwrap(res);
  },

  /* ─── Commission Overrides ───────────────────────────────────────────── */

  createOverride: async (data: { trainerId: string; customRate: number; reason?: string; validUntil?: string }) => {
    const res = await api.post('/commissions/override', data);
    return unwrap(res);
  },

  listOverrides: async (): Promise<CommissionOverrideItem[]> => {
    const res = await api.get('/commissions/overrides');
    const data = unwrap<CommissionOverrideItem[] | { items: CommissionOverrideItem[] }>(res);
    if (Array.isArray(data)) return data;
    return data.items;
  },

  getOverrideForTrainer: async (trainerId: string) => {
    const res = await api.get(`/commissions/override/${trainerId}`);
    return unwrap(res);
  },

  updateOverride: async (id: string, data: { customRate?: number; reason?: string; validUntil?: string; isActive?: boolean }) => {
    const res = await api.patch(`/commissions/override/${id}`, data);
    return unwrap(res);
  },

  deactivateOverride: async (id: string) => {
    const res = await api.delete(`/commissions/override/${id}`);
    return unwrap(res);
  },

  createOrgOverride: async (orgId: string, data: { customRate: number; reason?: string; validUntil?: string }) => {
    const res = await api.post(`/commissions/override/org/${orgId}`, data);
    return unwrap(res);
  },

  getOrgOverride: async (orgId: string) => {
    const res = await api.get(`/commissions/override/org/${orgId}`);
    return unwrap(res);
  },

  getTrainerRates: async (): Promise<TrainerRateItem[]> => {
    const res = await api.get('/commissions/trainer-rates');
    const data = unwrap<TrainerRateItem[]>(res);
    return Array.isArray(data) ? data : [];
  },
};
