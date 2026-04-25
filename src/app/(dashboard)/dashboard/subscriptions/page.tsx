'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DonutBreakdown, BarTrend } from '@/components/Charts';
import { subscriptionService, PlanData, SubscriptionStats } from '@/lib/services/subscriptionService';
import { userService } from '@/lib/services/userService';
import { SubscriptionPlan, Subscription, User } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function featuresForDisplay(features: SubscriptionPlan['features']): string {
  try {
    if (!features) return '';
    if (typeof features === 'string') {
      try {
        const parsed = JSON.parse(features);
        if (Array.isArray(parsed)) return parsed.join('\n');
        if (typeof parsed === 'object') return Object.values(parsed).join('\n');
      } catch { return features; }
    }
    if (Array.isArray(features)) return features.join('\n');
    if (typeof features === 'object') return Object.values(features as Record<string, unknown>).join('\n');
    return String(features);
  } catch { return ''; }
}

function parsePlanFeaturesList(features: SubscriptionPlan['features']): string[] {
  return featuresForDisplay(features).split('\n').map((s) => s.trim()).filter(Boolean);
}

const BILLING_CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];

const TRAINER_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'VOCATIONAL', label: 'Vocational' },
  { value: 'BOTH', label: 'Both' },
];

const EMPTY_FORM = {
  name: '', description: '', price: 0, currency: 'KES',
  durationDays: 30, billingCycle: 'monthly', features: '',
  maxBookings: '', maxTeamMembers: '', commissionRate: '',
  trainerType: '', isActive: true, isGlobal: true, orgId: '', sortOrder: 0,
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function MetricCard({ label, value, loading, accent }: { label: string; value: string; loading: boolean; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        {accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-muted rounded-lg animate-pulse" />
      ) : (
        <span className="text-2xl font-bold text-card-foreground tabular-nums">{value}</span>
      )}
    </div>
  );
}

function TrainerTypePill({ type }: { type: string | null }) {
  if (!type) return <span className="text-xs text-muted-foreground">All Types</span>;
  const map: Record<string, string> = {
    PROFESSIONAL: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    VOCATIONAL: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    BOTH: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[type] ?? 'bg-muted text-muted-foreground border-border'}`}>
      {type}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlanCard({
  plan,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
}: {
  plan: SubscriptionPlan;
  onEdit: (p: SubscriptionPlan) => void;
  onDuplicate: (p: SubscriptionPlan) => void;
  onDelete: (p: SubscriptionPlan) => void;
  onToggle: (p: SubscriptionPlan) => void;
}) {
  const featureList = parsePlanFeaturesList(plan.features);
  const shown = featureList.slice(0, 5);
  const extra = featureList.length - shown.length;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-card-foreground leading-tight">{plan.name}</h3>
            {plan.isGlobal && !plan.orgId && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                GLOBAL
              </span>
            )}
            {plan.orgId && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800">
                ORG
              </span>
            )}
          </div>
          {plan.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{plan.description}</p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(plan); }}
          className="flex-shrink-0"
          title={plan.isActive ? 'Click to deactivate' : 'Click to activate'}
        >
          <StatusBadge status={plan.isActive ? 'ACTIVE' : 'INACTIVE'} />
        </button>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums text-card-foreground">
          {formatCurrency(Number(plan.price), plan.currency || 'KES')}
        </span>
        <span className="text-sm text-muted-foreground capitalize">/ {plan.billingCycle || 'month'}</span>
      </div>

      {/* Features */}
      {shown.length > 0 ? (
        <ul className="space-y-2 flex-1">
          {shown.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckIcon />
              <span>{f}</span>
            </li>
          ))}
          {extra > 0 && (
            <li className="text-xs text-muted-foreground pl-5">+{extra} more</li>
          )}
        </ul>
      ) : (
        <div className="flex-1" />
      )}

      {/* Limits row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground border-t border-border pt-3">
        <span>
          {plan.maxBookings != null ? `${plan.maxBookings} bookings` : 'Unlimited bookings'}
        </span>
        <span>·</span>
        <span>{plan.durationDays ?? 30} days</span>
        {plan.maxTeamMembers != null && (
          <>
            <span>·</span>
            <span>{plan.maxTeamMembers} team members</span>
          </>
        )}
        {plan.commissionRate != null && (
          <>
            <span>·</span>
            <span>{(Number(plan.commissionRate) * 100).toFixed(0)}% commission</span>
          </>
        )}
      </div>

      {/* Footer: trainer type + actions */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <TrainerTypePill type={plan.trainerType ?? null} />
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(plan); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(plan); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors"
            title="Duplicate"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(plan); }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
            title="Deactivate"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab helper                                                         */
/* ------------------------------------------------------------------ */

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-[#F77B0F] text-white shadow-sm'
          : 'text-muted-foreground hover:text-card-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

function UnderlineTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'border-[#F77B0F] text-[#F77B0F] dark:border-blue-400 dark:text-blue-400'
          : 'border-transparent text-muted-foreground hover:text-card-foreground'
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Form input class                                                   */
/* ------------------------------------------------------------------ */

const ic = 'w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#F77B0F]/30 focus:border-[#F77B0F]';

/* ------------------------------------------------------------------ */
/*  Org plan table columns reused                                      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function SubscriptionsPage() {
  const { addToast } = useToast();

  const [mainTab, setMainTab] = useState<'plans' | 'subscribers' | 'revenue'>('plans');

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [planSubTab, setPlanSubTab] = useState<'global' | 'org'>('global');

  const [orgs, setOrgs] = useState<User[]>([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [orgPlans, setOrgPlans] = useState<SubscriptionPlan[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [duplicateMode, setDuplicateMode] = useState(false);
  const [delDialog, setDelDialog] = useState<{ open: boolean; plan: SubscriptionPlan | null }>({ open: false, plan: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subPage, setSubPage] = useState(1);
  const [subTotalPages, setSubTotalPages] = useState(1);
  const [subTotal, setSubTotal] = useState(0);
  const [subStatusFilter, setSubStatusFilter] = useState('');
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; sub: Subscription | null }>({ open: false, sub: null });

  /* ================================================================ */
  /*  Data fetching                                                    */
  /* ================================================================ */

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try { setPlans(await subscriptionService.getAllPlans()); }
    catch { addToast('error', 'Failed to load plans'); }
    finally { setPlansLoading(false); }
  }, [addToast]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try { setStats(await subscriptionService.getStats()); }
    catch { /* stats are non-critical */ }
    finally { setStatsLoading(false); }
  }, []);

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await userService.getAll({ role: 'TRAINER', limit: 100 });
      setOrgs(res.items || []);
    } catch { /* non-critical */ }
  }, []);

  const fetchOrgPlans = useCallback(async (orgId: string) => {
    if (!orgId) { setOrgPlans([]); return; }
    setOrgLoading(true);
    try { setOrgPlans(await subscriptionService.getOrgPlans(orgId)); }
    catch { addToast('error', 'Failed to load org plans'); }
    finally { setOrgLoading(false); }
  }, [addToast]);

  const fetchSubs = useCallback(async () => {
    setSubsLoading(true);
    try {
      const d = await subscriptionService.getSubscriptions({
        page: subPage, limit: 10,
        ...(subStatusFilter ? { status: subStatusFilter } : {}),
      });
      setSubs(d.items);
      setSubTotalPages(d.totalPages);
      setSubTotal(d.total);
    } catch { addToast('error', 'Failed to load subscribers'); }
    finally { setSubsLoading(false); }
  }, [subPage, subStatusFilter, addToast]);

  useEffect(() => { fetchPlans(); fetchStats(); fetchOrgs(); }, [fetchPlans, fetchStats, fetchOrgs]);
  useEffect(() => { if (selectedOrg) fetchOrgPlans(selectedOrg); }, [selectedOrg, fetchOrgPlans]);
  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  /* ================================================================ */
  /*  Plan form handlers                                               */
  /* ================================================================ */

  const handleOpenCreate = (forOrg?: boolean) => {
    setEditing(null);
    setDuplicateMode(false);
    setForm({ ...EMPTY_FORM, isGlobal: !forOrg, orgId: forOrg && selectedOrg ? selectedOrg : '' });
    setModalOpen(true);
  };

  const handleOpenEdit = (plan: SubscriptionPlan) => {
    setEditing(plan);
    setDuplicateMode(false);
    setForm({
      name: plan.name,
      description: plan.description || '',
      price: Number(plan.price),
      currency: plan.currency || 'KES',
      durationDays: plan.durationDays ?? 30,
      billingCycle: plan.billingCycle || 'monthly',
      features: featuresForDisplay(plan.features),
      maxBookings: plan.maxBookings != null ? String(plan.maxBookings) : '',
      maxTeamMembers: plan.maxTeamMembers != null ? String(plan.maxTeamMembers) : '',
      commissionRate: plan.commissionRate != null ? String(plan.commissionRate) : '',
      trainerType: plan.trainerType || '',
      isActive: plan.isActive,
      isGlobal: plan.isGlobal,
      orgId: plan.orgId || '',
      sortOrder: plan.sortOrder,
    });
    setModalOpen(true);
  };

  const handleOpenDuplicate = (plan: SubscriptionPlan) => {
    setEditing(plan);
    setDuplicateMode(true);
    setForm({
      name: `${plan.name} (Copy)`,
      description: plan.description || '',
      price: Number(plan.price),
      currency: plan.currency || 'KES',
      durationDays: plan.durationDays ?? 30,
      billingCycle: plan.billingCycle || 'monthly',
      features: featuresForDisplay(plan.features),
      maxBookings: plan.maxBookings != null ? String(plan.maxBookings) : '',
      maxTeamMembers: plan.maxTeamMembers != null ? String(plan.maxTeamMembers) : '',
      commissionRate: plan.commissionRate != null ? String(plan.commissionRate) : '',
      trainerType: plan.trainerType || '',
      isActive: true,
      isGlobal: plan.isGlobal,
      orgId: plan.orgId || '',
      sortOrder: plan.sortOrder,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { addToast('error', 'Name is required'); return; }
    setActionLoading(true);
    try {
      const lines = form.features.split('\n').map((l) => l.trim()).filter(Boolean);
      const payload: PlanData = {
        name: form.name,
        description: form.description,
        price: form.price,
        currency: form.currency,
        durationDays: form.durationDays,
        billingCycle: form.billingCycle,
        features: lines.length > 0 ? lines : [],
        maxBookings: form.maxBookings ? Number(form.maxBookings) : null,
        maxTeamMembers: form.maxTeamMembers ? Number(form.maxTeamMembers) : null,
        commissionRate: form.commissionRate ? Number(form.commissionRate) : null,
        trainerType: form.trainerType || null,
        isActive: form.isActive,
        isGlobal: form.isGlobal,
        orgId: form.orgId || null,
        sortOrder: form.sortOrder,
      };

      if (duplicateMode && editing) {
        await subscriptionService.duplicatePlan(editing.id, { name: form.name, orgId: form.orgId || undefined });
        addToast('success', 'Plan duplicated');
      } else if (editing) {
        await subscriptionService.updatePlan(editing.id, payload);
        addToast('success', 'Plan updated');
      } else if (form.orgId && !form.isGlobal) {
        await subscriptionService.createOrgPlan(form.orgId, payload);
        addToast('success', 'Organization plan created');
      } else {
        await subscriptionService.createPlan(payload);
        addToast('success', 'Plan created');
      }

      setModalOpen(false);
      fetchPlans();
      fetchStats();
      if (selectedOrg) fetchOrgPlans(selectedOrg);
    } catch {
      addToast('error', 'Failed to save plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle = async (plan: SubscriptionPlan) => {
    try {
      await subscriptionService.togglePlan(plan.id);
      addToast('success', `Plan ${plan.isActive ? 'deactivated' : 'activated'}`);
      fetchPlans();
      if (selectedOrg) fetchOrgPlans(selectedOrg);
    } catch {
      addToast('error', 'Failed to toggle plan');
    }
  };

  const handleDeletePlan = async () => {
    if (!delDialog.plan) return;
    setActionLoading(true);
    try {
      await subscriptionService.deletePlan(delDialog.plan.id);
      addToast('success', 'Plan deactivated');
      setDelDialog({ open: false, plan: null });
      fetchPlans();
      fetchStats();
      if (selectedOrg) fetchOrgPlans(selectedOrg);
    } catch {
      addToast('error', 'Failed to delete plan');
    } finally {
      setActionLoading(false);
    }
  };

  /* ================================================================ */
  /*  Org plan table columns                                           */
  /* ================================================================ */

  const planTableCols: Column<SubscriptionPlan>[] = [
    {
      key: 'name', label: 'Plan', sortable: true,
      render: (p) => (
        <div>
          <span className="font-medium">{p.name}</span>
          {p.orgId && <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800">ORG</span>}
        </div>
      ),
    },
    { key: 'price', label: 'Price', render: (p) => formatCurrency(Number(p.price), p.currency || 'KES') },
    { key: 'billingCycle', label: 'Billing', render: (p) => <span className="capitalize">{p.billingCycle || 'monthly'}</span> },
    { key: 'durationDays', label: 'Duration', render: (p) => `${p.durationDays ?? 0}d` },
    { key: 'maxBookings', label: 'Max Bookings', render: (p) => p.maxBookings != null ? String(p.maxBookings) : <span className="text-muted-foreground">∞</span> },
    { key: 'maxTeamMembers', label: 'Max Team', render: (p) => p.maxTeamMembers != null ? String(p.maxTeamMembers) : <span className="text-muted-foreground">∞</span> },
    { key: 'commissionRate', label: 'Commission', render: (p) => p.commissionRate != null ? `${(Number(p.commissionRate) * 100).toFixed(1)}%` : <span className="text-muted-foreground">Default</span> },
    { key: 'trainerType', label: 'Type', render: (p) => <TrainerTypePill type={p.trainerType ?? null} /> },
    {
      key: 'isActive', label: 'Status',
      render: (p) => (
        <button onClick={(e) => { e.stopPropagation(); handleToggle(p); }}>
          <StatusBadge status={p.isActive ? 'ACTIVE' : 'INACTIVE'} />
        </button>
      ),
    },
    {
      key: 'actions', label: '',
      render: (p) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(p); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleOpenDuplicate(p); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Duplicate">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDelDialog({ open: true, plan: p }); }} className="p-1.5 rounded hover:bg-muted text-red-500" title="Deactivate">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      ),
    },
  ];

  /* ================================================================ */
  /*  Subscribers columns                                              */
  /* ================================================================ */

  const subCols: Column<Subscription>[] = [
    {
      key: 'user', label: 'Subscriber',
      render: (s) => (
        <div>
          <p className="font-medium text-sm">{s.user ? `${s.user.firstName} ${s.user.lastName}` : '-'}</p>
          <p className="text-xs text-muted-foreground">{s.user?.email || ''}</p>
        </div>
      ),
    },
    { key: 'plan', label: 'Plan', render: (s) => <span className="font-medium text-sm">{s.plan?.name || '-'}</span> },
    { key: 'status', label: 'Status', render: (s) => <StatusBadge status={s.status} /> },
    {
      key: 'startDate', label: 'Period',
      render: (s) => (
        <div className="text-xs">
          <p className="text-muted-foreground">{formatDate(s.startDate)}</p>
          <p className="text-muted-foreground">→ {formatDate(s.endDate)}</p>
        </div>
      ),
    },
    {
      key: 'autoRenew', label: 'Auto-Renew',
      render: (s) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.autoRenew ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-muted text-muted-foreground border border-border'}`}>
          {s.autoRenew ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'actions', label: '',
      render: (s) =>
        s.status === 'ACTIVE' ? (
          <button
            onClick={(e) => { e.stopPropagation(); setCancelDialog({ open: true, sub: s }); }}
            className="px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
          >
            Cancel
          </button>
        ) : null,
    },
  ];

  /* ================================================================ */
  /*  Revenue data                                                     */
  /* ================================================================ */

  const revenueByPlanChart = useMemo(() => {
    if (!stats?.revenueByPlan) return [];
    return stats.revenueByPlan.map((r) => ({ name: r.planName, value: r.totalRevenue }));
  }, [stats]);

  const subscriberTrend = useMemo(() => {
    if (!stats?.revenueByPlan) return [];
    return stats.revenueByPlan.map((r) => ({ date: r.planName, value: r.subscriberCount }));
  }, [stats]);

  const totalRevenue = useMemo(
    () => stats?.revenueByPlan?.reduce((s, r) => s + r.totalRevenue, 0) ?? 0,
    [stats],
  );

  const totalSubscribers = useMemo(
    () => stats?.revenueByPlan?.reduce((s, r) => s + r.subscriberCount, 0) ?? 0,
    [stats],
  );

  const churnRate = useMemo(() => {
    if (!stats || !totalSubscribers) return '0%';
    const total = stats.totalActive + stats.expiringSoon;
    if (total === 0) return '0%';
    return `${((stats.expiringSoon / total) * 100).toFixed(1)}%`;
  }, [stats, totalSubscribers]);

  const globalPlans = plans.filter((p) => p.isGlobal && !p.orgId);

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Subscriptions' }]}
        actions={
          mainTab === 'plans' ? (
            <button
              onClick={() => handleOpenCreate(planSubTab === 'org')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F77B0F] hover:bg-[#0f1e47] text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {planSubTab === 'org' && selectedOrg ? 'Create Org Plan' : 'Create Plan'}
            </button>
          ) : undefined
        }
      />

      {/* ─── Top-level tabs ─── */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-muted w-fit">
        {([
          { key: 'plans' as const, label: 'Plans' },
          { key: 'subscribers' as const, label: 'Subscribers' },
          { key: 'revenue' as const, label: 'Revenue' },
        ]).map((t) => (
          <Tab key={t.key} active={mainTab === t.key} onClick={() => setMainTab(t.key)}>
            {t.label}
          </Tab>
        ))}
      </div>

      {/* ================================================================ */}
      {/*  TAB 1: Plans                                                    */}
      {/* ================================================================ */}
      {mainTab === 'plans' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Plans" value={stats ? formatNumber(stats.totalPlans) : '—'} loading={statsLoading} />
            <MetricCard label="Active Plans" value={stats ? formatNumber(stats.activePlans) : '—'} loading={statsLoading} accent="#10B981" />
            <MetricCard label="MRR" value={stats ? formatCurrency(stats.mrr) : '—'} loading={statsLoading} accent="#F77B0F" />
            <MetricCard label="Expiring in 7d" value={stats ? formatNumber(stats.expiringSoon) : '—'} loading={statsLoading} accent="#F59E0B" />
          </div>

          {/* Global / Org sub-tabs */}
          <div className="flex gap-1 mb-6 border-b border-border">
            <UnderlineTab active={planSubTab === 'global'} onClick={() => setPlanSubTab('global')}>Global Plans</UnderlineTab>
            <UnderlineTab active={planSubTab === 'org'} onClick={() => setPlanSubTab('org')}>Organization Plans</UnderlineTab>
          </div>

          {/* Global Plans — card grid */}
          {planSubTab === 'global' && (
            <>
              {plansLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-2xl p-6 h-64 animate-pulse" />
                  ))}
                </div>
              ) : globalPlans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-border bg-card text-center">
                  <svg className="w-12 h-12 text-muted-foreground/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <p className="text-muted-foreground text-sm mb-3">No global subscription plans yet</p>
                  <button
                    onClick={() => handleOpenCreate(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F77B0F] hover:bg-[#0f1e47] text-white text-sm font-semibold transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Create First Plan
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {globalPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      onEdit={handleOpenEdit}
                      onDuplicate={handleOpenDuplicate}
                      onDelete={(p) => setDelDialog({ open: true, plan: p })}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Organization Plans */}
          {planSubTab === 'org' && (
            <div>
              <div className="mb-5 flex items-end gap-4">
                <div className="flex-1 max-w-sm">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Organization / Firm</label>
                  <select
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                    className={ic}
                  >
                    <option value="">Select an organization…</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.firstName} {o.lastName} ({o.email})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedOrg && (
                  <button
                    onClick={() => handleOpenCreate(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F77B0F] hover:bg-[#0f1e47] text-white text-sm font-semibold transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Create Custom Plan
                  </button>
                )}
              </div>

              {!selectedOrg ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-border bg-card text-center">
                  <svg className="w-10 h-10 text-muted-foreground/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-muted-foreground text-sm">Select an organization to view their plans</p>
                </div>
              ) : (
                <DataTable
                  columns={planTableCols}
                  data={orgPlans}
                  loading={orgLoading}
                  keyExtractor={(p) => p.id}
                  emptyMessage="No plans for this organization"
                />
              )}
            </div>
          )}
        </>
      )}

      {/* ================================================================ */}
      {/*  TAB 2: Subscribers                                              */}
      {/* ================================================================ */}
      {mainTab === 'subscribers' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <MetricCard label="Active Subscribers" value={stats ? formatNumber(stats.totalActive) : '—'} loading={statsLoading} accent="#10B981" />
            <MetricCard
              label="Expired / Cancelled"
              value={subTotal > (stats?.totalActive ?? 0) ? formatNumber(subTotal - (stats?.totalActive ?? 0)) : '0'}
              loading={statsLoading}
              accent="#F43F5E"
            />
            <MetricCard label="Expiring Soon" value={stats ? formatNumber(stats.expiringSoon) : '—'} loading={statsLoading} accent="#F59E0B" />
          </div>

          {/* Status pill filters */}
          <div className="flex flex-wrap items-center gap-2 mb-5 p-4 rounded-xl border border-border bg-card">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mr-1">Status</span>
            {[
              { value: '', label: 'All' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'EXPIRED', label: 'Expired' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'PAUSED', label: 'Paused' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSubStatusFilter(opt.value); setSubPage(1); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  subStatusFilter === opt.value
                    ? 'bg-[#F77B0F] text-white'
                    : 'bg-muted text-muted-foreground hover:text-card-foreground hover:bg-muted/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <DataTable
            columns={subCols}
            data={subs}
            loading={subsLoading}
            page={subPage}
            totalPages={subTotalPages}
            total={subTotal}
            onPageChange={setSubPage}
            keyExtractor={(s) => s.id}
            emptyMessage="No subscribers yet"
          />
        </>
      )}

      {/* ================================================================ */}
      {/*  TAB 3: Revenue                                                  */}
      {/* ================================================================ */}
      {mainTab === 'revenue' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Revenue" value={formatCurrency(totalRevenue)} loading={statsLoading} accent="#F77B0F" />
            <MetricCard label="MRR" value={stats ? formatCurrency(stats.mrr) : '—'} loading={statsLoading} accent="#7C3AED" />
            <MetricCard label="Total Subscribers" value={formatNumber(totalSubscribers)} loading={statsLoading} accent="#10B981" />
            <MetricCard label="Churn Rate" value={churnRate} loading={statsLoading} accent="#F43F5E" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <DonutBreakdown
              title="Revenue by Plan"
              subtitle="Total subscription revenue breakdown"
              data={revenueByPlanChart}
            />
            <BarTrend
              title="Subscribers by Plan"
              subtitle="Subscriber count per plan"
              data={subscriberTrend}
              color="#F77B0F"
              name="Subscribers"
            />
          </div>

          {/* Revenue detail table */}
          {stats?.revenueByPlan && stats.revenueByPlan.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-card-foreground">Revenue Breakdown by Plan</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">All-time subscription revenue per plan</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Plan</th>
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Billing</th>
                      <th className="text-right px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Price</th>
                      <th className="text-right px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Subscribers</th>
                      <th className="text-right px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.revenueByPlan.map((r) => (
                      <tr key={r.planId} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3.5 font-medium">{r.planName}</td>
                        <td className="px-6 py-3.5 capitalize text-muted-foreground">{r.billingCycle}</td>
                        <td className="px-6 py-3.5 text-right">{formatCurrency(r.price)}</td>
                        <td className="px-6 py-3.5 text-right tabular-nums">{r.subscriberCount}</td>
                        <td className="px-6 py-3.5 text-right font-semibold tabular-nums">{formatCurrency(r.totalRevenue)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 border-t-2 border-border">
                      <td className="px-6 py-3.5 font-semibold" colSpan={3}>Total</td>
                      <td className="px-6 py-3.5 text-right font-semibold tabular-nums">{totalSubscribers}</td>
                      <td className="px-6 py-3.5 text-right font-bold tabular-nums">{formatCurrency(totalRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ================================================================ */}
      {/*  Create / Edit / Duplicate Plan Modal                            */}
      {/* ================================================================ */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={duplicateMode ? 'Duplicate Plan' : editing ? 'Edit Plan' : 'Create Plan'}
        size="lg"
      >
        <div className="space-y-5">
          {/* Name & Description */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Plan Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={ic}
                placeholder="e.g. Pro Monthly"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className={ic}
                placeholder="Brief plan description…"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Pricing & Duration */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pricing & Duration</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Price</label>
                <input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className={ic} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Currency</label>
                <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={ic} placeholder="KES" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Duration (days)</label>
                <input type="number" min={1} value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })} className={ic} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Billing Cycle</label>
                <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} className={ic}>
                  {BILLING_CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Limits */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Limits & Commission</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Max Bookings</label>
                <input type="number" min={0} value={form.maxBookings} onChange={(e) => setForm({ ...form, maxBookings: e.target.value })} className={ic} placeholder="Unlimited" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Max Team Members</label>
                <input type="number" min={0} value={form.maxTeamMembers} onChange={(e) => setForm({ ...form, maxTeamMembers: e.target.value })} className={ic} placeholder="Unlimited" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Commission Rate (0–1)</label>
                <input type="number" min={0} max={1} step={0.01} value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} className={ic} placeholder="Default" />
              </div>
            </div>
          </div>

          {/* Trainer type + Sort order */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Trainer Type</label>
              <select value={form.trainerType} onChange={(e) => setForm({ ...form, trainerType: e.target.value })} className={ic}>
                {TRAINER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Sort Order</label>
              <input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className={ic} />
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Features <span className="font-normal normal-case">(one per line)</span></label>
            <textarea
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
              rows={4}
              className={ic}
              placeholder={"Unlimited bookings\nPriority support\nAdvanced analytics"}
            />
          </div>

          {/* Scope toggles */}
          <div className="flex items-center gap-6 p-3 rounded-lg bg-muted/50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isGlobal}
                onChange={(e) => setForm({ ...form, isGlobal: e.target.checked, orgId: e.target.checked ? '' : form.orgId })}
                className="rounded accent-[#F77B0F]"
              />
              <span className="text-sm font-medium">Global Plan</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded accent-[#F77B0F]"
              />
              <span className="text-sm font-medium">Active</span>
            </label>
          </div>

          {!form.isGlobal && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Organization (org-specific plan)</label>
              <select value={form.orgId} onChange={(e) => setForm({ ...form, orgId: e.target.value })} className={ic}>
                <option value="">Select organization…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.firstName} {o.lastName} ({o.email})</option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#F77B0F] hover:bg-[#0f1e47] text-white text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              {actionLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                  Saving…
                </>
              ) : duplicateMode ? 'Duplicate Plan' : editing ? 'Save Changes' : 'Create Plan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Delete Plan Confirmation ─── */}
      <ConfirmDialog
        isOpen={delDialog.open}
        onClose={() => setDelDialog({ open: false, plan: null })}
        onConfirm={handleDeletePlan}
        title="Deactivate Plan"
        message={`Are you sure you want to deactivate "${delDialog.plan?.name}"? Existing subscribers will keep their access until expiry.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        loading={actionLoading}
      />

      {/* ─── Cancel Subscription Confirmation ─── */}
      <ConfirmDialog
        isOpen={cancelDialog.open}
        onClose={() => setCancelDialog({ open: false, sub: null })}
        onConfirm={async () => {
          if (!cancelDialog.sub) return;
          setActionLoading(true);
          try {
            await subscriptionService.updatePlan(cancelDialog.sub.id, { isActive: false });
            addToast('success', 'Subscription cancelled');
            setCancelDialog({ open: false, sub: null });
            fetchSubs();
            fetchStats();
          } catch {
            addToast('error', 'Failed to cancel subscription');
          } finally {
            setActionLoading(false);
          }
        }}
        title="Cancel Subscription"
        message={`Cancel subscription for ${cancelDialog.sub?.user ? `${cancelDialog.sub.user.firstName} ${cancelDialog.sub.user.lastName}` : 'this user'}? They will lose access at the end of their current billing period.`}
        confirmLabel="Cancel Subscription"
        confirmVariant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
