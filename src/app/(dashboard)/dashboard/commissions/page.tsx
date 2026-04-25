'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LineTrend, DonutBreakdown, BarCompare } from '@/components/Charts';
import { commissionService, CommissionRuleData, CommissionAnalytics, TrainerCommissionListItem, CommissionOverrideItem } from '@/lib/services/commissionService';
import { CommissionRule, CommissionRecord } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDate } from '@/lib/utils';

/* ─── SVG Icons ────────────────────────────────────────────────────────────── */

const Icon = ({ d }: { d: string }) => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const DeleteIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

/* ─── Types ────────────────────────────────────────────────────────────────── */

type Tab = 'rules' | 'records' | 'analytics' | 'trainers';

interface CommissionStats {
  totalCommission: number;
  totalRecords: number;
  averageRate: number;
  thisMonth: number;
  last30Days: { commission: number; count: number };
}

const TRAINER_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'PROFESSIONAL', label: 'Professional (White Collar)' },
  { value: 'VOCATIONAL', label: 'Vocational (Blue Collar)' },
];

const SUBSCRIPTION_TIERS = ['', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'];

/* ─── Trainer Type Badge ───────────────────────────────────────────────────── */

function TrainerTypeBadge({ type }: { type?: string }) {
  if (!type) return <span className="text-muted-foreground text-xs">All</span>;
  const isWhite = type === 'PROFESSIONAL';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isWhite
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isWhite ? '0' : 'bg-amber-500'}`} />
      {isWhite ? 'White Collar' : 'Blue Collar'}
    </span>
  );
}

/* ─── Rate Source Badge ────────────────────────────────────────────────────── */

function RateSourceBadge({ source }: { source: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    override: { label: 'Override', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    org_override: { label: 'Org Override', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
    custom: { label: 'Custom', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    org_rule: { label: 'Org Rule', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
    subscription_plan: { label: 'Plan', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
    global_rule: { label: 'Global', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    waived: { label: 'Waived', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    default: { label: 'Default (10%)', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  };
  const c = config[source] || config['default'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.cls}`}>
      {c.label}
    </span>
  );
}

/* ─── MetricCard ────────────────────────────────────────────────────────────── */

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        {accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-2xl font-bold text-card-foreground tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function CommissionsPage() {
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>('rules');

  // Rules state
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);

  // Records state
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotalPages, setRecordsTotalPages] = useState(1);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsStartDate, setRecordsStartDate] = useState('');
  const [recordsEndDate, setRecordsEndDate] = useState('');
  const [trainerSearch, setTrainerSearch] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Stats state
  const [stats, setStats] = useState<CommissionStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Analytics state
  const [analytics, setAnalytics] = useState<CommissionAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Trainer rates state
  const [trainers, setTrainers] = useState<TrainerCommissionListItem[]>([]);
  const [trainersLoading, setTrainersLoading] = useState(true);
  const [trainersPage, setTrainersPage] = useState(1);
  const [trainersTotalPages, setTrainersTotalPages] = useState(1);
  const [trainersTotal, setTrainersTotal] = useState(0);
  const [trainerSearchQuery, setTrainerSearchQuery] = useState('');

  // Active overrides
  const [overrides, setOverrides] = useState<CommissionOverrideItem[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(false);

  // Trainer rate modal (override-based)
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [rateModalTrainer, setRateModalTrainer] = useState<TrainerCommissionListItem | null>(null);
  const [rateModalValue, setRateModalValue] = useState('');
  const [rateModalReason, setRateModalReason] = useState('');
  const [rateModalValidUntil, setRateModalValidUntil] = useState('');
  const [rateModalLoading, setRateModalLoading] = useState(false);

  // Org rate modal
  const [orgRateModalOpen, setOrgRateModalOpen] = useState(false);
  const [orgRateModalTrainer, setOrgRateModalTrainer] = useState<TrainerCommissionListItem | null>(null);
  const [orgRateModalValue, setOrgRateModalValue] = useState('');
  const [orgRateModalReason, setOrgRateModalReason] = useState('');
  const [orgRateModalValidUntil, setOrgRateModalValidUntil] = useState('');
  const [orgRateModalLoading, setOrgRateModalLoading] = useState(false);

  // Trainer waive modal
  const [waiveModalOpen, setWaiveModalOpen] = useState(false);
  const [waiveModalTrainer, setWaiveModalTrainer] = useState<TrainerCommissionListItem | null>(null);
  const [waiveModalDate, setWaiveModalDate] = useState('');
  const [waiveModalLoading, setWaiveModalLoading] = useState(false);

  // Trainer remove override confirm
  const [removeDialog, setRemoveDialog] = useState<{ open: boolean; trainer: TrainerCommissionListItem | null }>({
    open: false,
    trainer: null,
  });
  const [removeLoading, setRemoveLoading] = useState(false);

  // Deactivate override confirm
  const [deactivateDialog, setDeactivateDialog] = useState<{ open: boolean; override: CommissionOverrideItem | null }>({
    open: false,
    override: null,
  });
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // Rule form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommissionRule | null>(null);
  const [form, setForm] = useState<CommissionRuleData>({
    name: '',
    minAmount: 0,
    maxAmount: 0,
    commissionRate: 0.1,
    subscriptionTier: '',
    trainerType: '',
    orgId: '',
    isActive: true,
  });
  const [saveLoading, setSaveLoading] = useState(false);

  // Delete confirmation
  const [delDialog, setDelDialog] = useState<{ open: boolean; rule: CommissionRule | null }>({
    open: false,
    rule: null,
  });
  const [delLoading, setDelLoading] = useState(false);

  /* ─── Fetch ─────────────────────────────────────────────────────────────── */

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const data = await commissionService.getRules();
      setRules(Array.isArray(data) ? data : []);
    } catch {
      addToast('error', 'Failed to load commission rules');
    } finally {
      setRulesLoading(false);
    }
  }, [addToast]);

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const data = await commissionService.getRecords({
        page: recordsPage,
        limit: 10,
        startDate: recordsStartDate || undefined,
        endDate: recordsEndDate || undefined,
        trainerSearch: trainerSearch || undefined,
        minAmount: minAmount ? Number(minAmount) : undefined,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
      });
      setRecords(data.items);
      setRecordsTotalPages(data.totalPages);
      setRecordsTotal(data.total);
    } catch {
      addToast('error', 'Failed to load commission records');
    } finally {
      setRecordsLoading(false);
    }
  }, [recordsPage, recordsStartDate, recordsEndDate, trainerSearch, minAmount, maxAmount, addToast]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await commissionService.getStats();
      setStats(data);
    } catch {
      addToast('error', 'Failed to load commission stats');
    } finally {
      setStatsLoading(false);
    }
  }, [addToast]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await commissionService.getAnalytics();
      setAnalytics(data);
    } catch {
      addToast('error', 'Failed to load commission analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [addToast]);

  const fetchTrainers = useCallback(async () => {
    setTrainersLoading(true);
    try {
      const data = await commissionService.listTrainersWithCommission({
        search: trainerSearchQuery || undefined,
        page: trainersPage,
        limit: 15,
      });
      setTrainers(data.items);
      setTrainersTotalPages(data.totalPages);
      setTrainersTotal(data.total);
    } catch {
      addToast('error', 'Failed to load trainer commission data');
    } finally {
      setTrainersLoading(false);
    }
  }, [trainersPage, trainerSearchQuery, addToast]);

  const fetchOverrides = useCallback(async () => {
    setOverridesLoading(true);
    try {
      const data = await commissionService.listOverrides();
      setOverrides(Array.isArray(data) ? data : []);
    } catch {
      // silent — overrides section is supplementary
    } finally {
      setOverridesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchStats();
  }, [fetchRules, fetchStats]);

  useEffect(() => {
    if (tab === 'records') fetchRecords();
  }, [tab, fetchRecords]);

  useEffect(() => {
    if (tab === 'analytics') fetchAnalytics();
  }, [tab, fetchAnalytics]);

  useEffect(() => {
    if (tab === 'trainers') {
      fetchTrainers();
      fetchOverrides();
    }
  }, [tab, fetchTrainers, fetchOverrides]);

  /* ─── Derived Stats ─────────────────────────────────────────────────────── */

  const activeRulesCount = rules.filter((r) => r.isActive).length;
  const orgSpecificCount = rules.filter((r) => r.orgId && r.orgId !== '').length;
  const rates = rules
    .filter((r) => r.isActive)
    .map((r) => Number(r.commissionRate ?? r.rate ?? 0));
  const lowestRate = rates.length > 0 ? Math.min(...rates) : 0;
  const highestRate = rates.length > 0 ? Math.max(...rates) : 0;
  const defaultRule = rules.find(
    (r) => r.isActive && !r.orgId && !r.subscriptionTier && !r.trainerType
  );
  const defaultRate = defaultRule
    ? Number(defaultRule.commissionRate ?? defaultRule.rate ?? 0)
    : rates.length > 0
    ? rates[0]
    : 0;

  /* ─── Handlers ──────────────────────────────────────────────────────────── */

  const handleSave = async () => {
    if (!form.name.trim()) {
      addToast('error', 'Rule name is required');
      return;
    }
    if (form.commissionRate <= 0 || form.commissionRate > 1) {
      addToast('error', 'Commission rate must be between 0 and 1 (e.g. 0.1 = 10%)');
      return;
    }
    setSaveLoading(true);
    try {
      const payload: CommissionRuleData = {
        ...form,
        subscriptionTier: form.subscriptionTier || undefined,
        trainerType: form.trainerType || undefined,
        orgId: form.orgId || undefined,
      };
      if (editing) {
        await commissionService.updateRule(editing.id, payload);
        addToast('success', 'Rule updated');
      } else {
        await commissionService.createRule(payload);
        addToast('success', 'Rule created');
      }
      setModalOpen(false);
      setEditing(null);
      fetchRules();
    } catch {
      addToast('error', `Failed to ${editing ? 'update' : 'create'} rule`);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!delDialog.rule) return;
    setDelLoading(true);
    try {
      await commissionService.deleteRule(delDialog.rule.id);
      addToast('success', 'Rule deleted');
      setDelDialog({ open: false, rule: null });
      fetchRules();
    } catch {
      addToast('error', 'Failed to delete rule');
    } finally {
      setDelLoading(false);
    }
  };

  const handleToggleRule = async (rule: CommissionRule) => {
    try {
      await commissionService.toggleRule(rule.id, !rule.isActive);
      addToast('success', `Rule ${rule.isActive ? 'deactivated' : 'activated'}`);
      fetchRules();
    } catch {
      addToast('error', 'Failed to toggle rule');
    }
  };

  const openCreateModal = () => {
    setEditing(null);
    setForm({
      name: '',
      minAmount: 0,
      maxAmount: 0,
      commissionRate: 0.1,
      subscriptionTier: '',
      trainerType: '',
      orgId: '',
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (rule: CommissionRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      minAmount: Number(rule.minAmount) || 0,
      maxAmount: Number(rule.maxAmount) || 0,
      commissionRate: Number(rule.commissionRate ?? rule.rate ?? 0),
      subscriptionTier: rule.subscriptionTier || '',
      trainerType: rule.trainerType || '',
      orgId: rule.orgId || '',
      isActive: rule.isActive,
    });
    setModalOpen(true);
  };

  const clearRecordFilters = () => {
    setRecordsStartDate('');
    setRecordsEndDate('');
    setTrainerSearch('');
    setMinAmount('');
    setMaxAmount('');
    setRecordsPage(1);
  };

  const hasRecordFilters = recordsStartDate || recordsEndDate || trainerSearch || minAmount || maxAmount;

  /* ─── Trainer Rate Handlers ────────────────────────────────────────────── */

  const openSetRateModal = (trainer: TrainerCommissionListItem) => {
    setRateModalTrainer(trainer);
    setRateModalValue(trainer.override?.customRate != null ? String(trainer.override.customRate) : trainer.customRate != null ? String(trainer.customRate) : '');
    setRateModalReason('');
    setRateModalValidUntil('');
    setRateModalOpen(true);
  };

  const handleSetRate = async () => {
    if (!rateModalTrainer) return;
    const rate = Number(rateModalValue);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      addToast('error', 'Rate must be between 0 and 1 (e.g. 0.08 = 8%)');
      return;
    }
    setRateModalLoading(true);
    try {
      await commissionService.createOverride({
        trainerId: rateModalTrainer.trainerId,
        customRate: rate,
        reason: rateModalReason || undefined,
        validUntil: rateModalValidUntil || undefined,
      });
      addToast('success', `Custom rate set for ${rateModalTrainer.trainerName}`);
      setRateModalOpen(false);
      setRateModalTrainer(null);
      fetchTrainers();
      fetchOverrides();
    } catch {
      addToast('error', 'Failed to set custom rate');
    } finally {
      setRateModalLoading(false);
    }
  };

  const openOrgRateModal = (trainer: TrainerCommissionListItem) => {
    setOrgRateModalTrainer(trainer);
    setOrgRateModalValue('');
    setOrgRateModalReason('');
    setOrgRateModalValidUntil('');
    setOrgRateModalOpen(true);
  };

  const handleSetOrgRate = async () => {
    if (!orgRateModalTrainer || !orgRateModalTrainer.orgId) return;
    const rate = Number(orgRateModalValue);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      addToast('error', 'Rate must be between 0 and 1 (e.g. 0.08 = 8%)');
      return;
    }
    setOrgRateModalLoading(true);
    try {
      await commissionService.createOrgOverride(orgRateModalTrainer.orgId, {
        customRate: rate,
        reason: orgRateModalReason || undefined,
        validUntil: orgRateModalValidUntil || undefined,
      });
      addToast('success', `Org-wide rate set for ${orgRateModalTrainer.orgName}`);
      setOrgRateModalOpen(false);
      setOrgRateModalTrainer(null);
      fetchTrainers();
      fetchOverrides();
    } catch {
      addToast('error', 'Failed to set org rate');
    } finally {
      setOrgRateModalLoading(false);
    }
  };

  const openWaiveModal = (trainer: TrainerCommissionListItem) => {
    setWaiveModalTrainer(trainer);
    setWaiveModalDate(trainer.commissionWaivedUntil ? trainer.commissionWaivedUntil.slice(0, 10) : '');
    setWaiveModalOpen(true);
  };

  const handleWaive = async () => {
    if (!waiveModalTrainer || !waiveModalDate) {
      addToast('error', 'Please select a date');
      return;
    }
    setWaiveModalLoading(true);
    try {
      await commissionService.waiveTrainer(waiveModalTrainer.trainerId, new Date(waiveModalDate).toISOString());
      addToast('success', `Commission waived for ${waiveModalTrainer.trainerName}`);
      setWaiveModalOpen(false);
      setWaiveModalTrainer(null);
      fetchTrainers();
    } catch {
      addToast('error', 'Failed to waive commission');
    } finally {
      setWaiveModalLoading(false);
    }
  };

  const handleRemoveOverride = async () => {
    if (!removeDialog.trainer) return;
    setRemoveLoading(true);
    try {
      // If the trainer has an override, deactivate it
      if (removeDialog.trainer.override?.id) {
        await commissionService.deactivateOverride(removeDialog.trainer.override.id);
      }
      // Also remove legacy profile rate
      await commissionService.removeTrainerRate(removeDialog.trainer.trainerId);
      addToast('success', `Override removed for ${removeDialog.trainer.trainerName}`);
      setRemoveDialog({ open: false, trainer: null });
      fetchTrainers();
      fetchOverrides();
    } catch {
      addToast('error', 'Failed to remove override');
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleDeactivateOverride = async () => {
    if (!deactivateDialog.override) return;
    setDeactivateLoading(true);
    try {
      await commissionService.deactivateOverride(deactivateDialog.override.id);
      addToast('success', `Override deactivated for ${deactivateDialog.override.trainerName || 'org'}`);
      setDeactivateDialog({ open: false, override: null });
      fetchTrainers();
      fetchOverrides();
    } catch {
      addToast('error', 'Failed to deactivate override');
    } finally {
      setDeactivateLoading(false);
    }
  };

  /* ─── Rule description helper ───────────────────────────────────────────── */

  function ruleDescription(r: CommissionRule): string {
    const parts: string[] = [];
    const trainerType = r.trainerType;
    if (trainerType === 'PROFESSIONAL') {
      parts.push('Professional (White Collar) trainers');
    } else if (trainerType === 'VOCATIONAL') {
      parts.push('Vocational (Blue Collar) trainers');
    } else {
      parts.push('All trainers');
    }
    if (r.orgId && r.orgName) {
      parts.push(`in ${r.orgName}`);
    } else if (r.orgId) {
      parts.push('in a specific organization');
    }
    const min = Number(r.minAmount);
    const max = Number(r.maxAmount);
    if (min > 0 || max > 0) {
      parts.push(`with bookings between ${formatCurrency(min)} - ${formatCurrency(max)}`);
    }
    if (r.subscriptionTier) {
      parts.push(`on ${r.subscriptionTier} plan`);
    }
    return `This rule applies to ${parts.join(' ')}`;
  }

  const ic =
    'w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50';

  /* ─── Rule Columns ──────────────────────────────────────────────────────── */

  const ruleCols: Column<CommissionRule>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (r) => (
        <div>
          <span className="font-medium">{r.name}</span>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs truncate">
            {ruleDescription(r)}
          </p>
        </div>
      ),
    },
    {
      key: 'rate',
      label: 'Rate',
      render: (r) => {
        const rate = Number(r.commissionRate ?? r.rate ?? 0);
        return (
          <span className="font-bold text-lg text-[#192C67] dark:text-blue-400">
            {(rate * 100).toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: 'amountRange',
      label: 'Amount Range',
      render: (r) => (
        <span className="text-sm">
          {formatCurrency(Number(r.minAmount))} - {formatCurrency(Number(r.maxAmount))}
        </span>
      ),
    },
    {
      key: 'subscriptionTier',
      label: 'Tier',
      render: (r) =>
        r.subscriptionTier ? (
          <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium">{r.subscriptionTier}</span>
        ) : (
          <span className="text-muted-foreground text-xs">All</span>
        ),
    },
    {
      key: 'trainerType',
      label: 'Trainer Type',
      render: (r) => <TrainerTypeBadge type={r.trainerType} />,
    },
    {
      key: 'org',
      label: 'Organization',
      render: (r) =>
        r.orgId ? (
          <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-medium">
            {r.orgName || r.orgId.slice(0, 8)}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
            Global
          </span>
        ),
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleRule(r);
          }}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            r.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          title={r.isActive ? 'Click to deactivate' : 'Click to activate'}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              r.isActive ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
            style={{ transform: `translateX(${r.isActive ? '18px' : '2px'})` }}
          />
        </button>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(r);
            }}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground"
            title="Edit rule"
          >
            <EditIcon />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDelDialog({ open: true, rule: r });
            }}
            className="p-1.5 rounded hover:bg-muted text-red-500"
            title="Delete rule"
          >
            <DeleteIcon />
          </button>
        </div>
      ),
    },
  ];

  /* ─── Record Columns ────────────────────────────────────────────────────── */

  const recCols: Column<CommissionRecord>[] = [
    {
      key: 'bookingId',
      label: 'Booking',
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {r.bookingId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'trainer',
      label: 'Trainer',
      render: (r) => {
        const name =
          r.trainerName ||
          (r.trainer ? `${r.trainer.firstName} ${r.trainer.lastName}` : '') ||
          (r.booking?.trainer ? `${r.booking.trainer.user.firstName} ${r.booking.trainer.user.lastName}` : '');
        const org = r.trainerOrgName || r.trainer?.orgName || '';
        return (
          <div>
            <span className="font-medium text-sm">{name || 'N/A'}</span>
            {org && <p className="text-[11px] text-muted-foreground">{org}</p>}
          </div>
        );
      },
    },
    {
      key: 'client',
      label: 'Client',
      render: (r) => {
        const name =
          r.clientName ||
          (r.client ? `${r.client.firstName} ${r.client.lastName}` : '') ||
          (r.booking?.client ? `${r.booking.client.firstName} ${r.booking.client.lastName}` : '');
        return <span className="text-sm">{name || 'N/A'}</span>;
      },
    },
    {
      key: 'amount',
      label: 'Booking Amount',
      render: (r) =>
        formatCurrency(Number(r.bookingAmount ?? r.amount ?? 0)),
    },
    {
      key: 'rate',
      label: 'Rate',
      render: (r) => {
        const rate = Number(r.commissionRate ?? r.rate ?? 0);
        return (
          <span className="font-medium text-primary-500">
            {(rate * 100).toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: 'split',
      label: 'Split',
      render: (r) => {
        const bookingAmt = Number(r.bookingAmount ?? r.amount ?? 0);
        const commAmt = Number(r.commissionAmount ?? r.commission ?? 0);
        const trainerAmt = Number(r.trainerPayoutAmount ?? r.trainerPayout ?? 0);
        const rate = Number(r.commissionRate ?? r.rate ?? 0);
        return (
          <div className="text-xs space-y-0.5">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Platform:</span>
              <span className="font-semibold text-secondary-500">
                {formatCurrency(commAmt)}
              </span>
              <span className="text-muted-foreground">({(rate * 100).toFixed(0)}%)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Trainer:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(trainerAmt)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (r) => (
        <span className="text-muted-foreground text-sm">{formatDate(r.createdAt)}</span>
      ),
    },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'rules', label: 'Commission Rules' },
    { key: 'records', label: 'Commission Records' },
    { key: 'trainers', label: 'Trainer Rates' },
    { key: 'analytics', label: 'Analytics' },
  ];

  return (
    <div>
      <PageHeader
        title="Commissions"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Commissions' }]}
        actions={
          tab === 'rules' ? (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#192C67] hover:bg-[#0f1e47] text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Rule
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-muted w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-[#192C67] text-white shadow-sm'
                : 'text-muted-foreground hover:text-card-foreground hover:bg-muted/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════ Tab 1: Commission Rules ═══════════════════════════ */}
      {tab === 'rules' && (
        <>
          {/* Rules Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <MetricCard label="Active Rules" value={activeRulesCount} accent="#10B981" />
            <MetricCard label="Default Rate" value={`${(defaultRate * 100).toFixed(1)}%`} accent="#192C67" />
            <MetricCard label="Org-Specific" value={orgSpecificCount} />
            <MetricCard label="Lowest Rate" value={rates.length > 0 ? `${(lowestRate * 100).toFixed(1)}%` : 'N/A'} accent="#06B6D4" />
            <MetricCard label="Highest Rate" value={rates.length > 0 ? `${(highestRate * 100).toFixed(1)}%` : 'N/A'} accent="#F77B0F" />
          </div>

          <DataTable
            columns={ruleCols}
            data={rules}
            loading={rulesLoading}
            keyExtractor={(r) => r.id}
            emptyMessage="No commission rules configured. Create your first rule to get started."
          />
        </>
      )}

      {/* ═══════════════════ Tab 2: Commission Records ═════════════════════════ */}
      {tab === 'records' && (
        <>
          {/* Records Stats */}
          {!statsLoading && stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard label="Total Commission" value={formatCurrency(Number(stats.totalCommission))} sub="Platform revenue" accent="#192C67" />
              <MetricCard label="This Month" value={formatCurrency(Number(stats.thisMonth || stats.last30Days?.commission || 0))} sub={`${stats.last30Days?.count || 0} records`} accent="#10B981" />
              <MetricCard label="Average Rate" value={`${((Number(stats.averageRate) || 0) * 100).toFixed(1)}%`} sub="Across all records" />
              <MetricCard label="Total Records" value={stats.totalRecords} />
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 mb-4 bg-card rounded-lg border border-border p-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
              <input
                type="date"
                value={recordsStartDate}
                onChange={(e) => { setRecordsStartDate(e.target.value); setRecordsPage(1); }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-36"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">End Date</label>
              <input
                type="date"
                value={recordsEndDate}
                onChange={(e) => { setRecordsEndDate(e.target.value); setRecordsPage(1); }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-36"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Trainer</label>
              <input
                type="text"
                value={trainerSearch}
                onChange={(e) => { setTrainerSearch(e.target.value); setRecordsPage(1); }}
                placeholder="Search trainer..."
                className="px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-40"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Min Amount</label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => { setMinAmount(e.target.value); setRecordsPage(1); }}
                placeholder="0"
                className="px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-28"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Max Amount</label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => { setMaxAmount(e.target.value); setRecordsPage(1); }}
                placeholder="999999"
                className="px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-28"
              />
            </div>
            {hasRecordFilters && (
              <button
                onClick={clearRecordFilters}
                className="px-3 py-2 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
              >
                Clear Filters
              </button>
            )}
          </div>

          <DataTable
            columns={recCols}
            data={records}
            loading={recordsLoading}
            page={recordsPage}
            totalPages={recordsTotalPages}
            total={recordsTotal}
            onPageChange={setRecordsPage}
            keyExtractor={(r) => r.id}
            emptyMessage="No commission records found"
          />
        </>
      )}

      {/* ═══════════════════ Tab 3: Trainer Rates ════════════════════════════ */}
      {tab === 'trainers' && (
        <>
          {/* Active Overrides Section */}
          {!overridesLoading && overrides.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-card-foreground">Active Overrides ({overrides.length})</h3>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Trainer / Org</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Rate</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Reason</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Expires</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {overrides.map((o) => (
                      <tr key={o.id} className="bg-card hover:bg-muted/50">
                        <td className="px-3 py-2">
                          <div>
                            <span className="font-medium">{o.trainerName || (o.orgId ? `Org: ${o.orgId.slice(0, 8)}...` : 'Unknown')}</span>
                            {o.trainerEmail && <p className="text-[11px] text-muted-foreground">{o.trainerEmail}</p>}
                            {o.orgId && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">Org-wide</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="font-bold text-primary-500">{(o.customRate * 100).toFixed(1)}%</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs max-w-xs truncate">{o.reason || '-'}</td>
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                          {o.validUntil ? new Date(o.validUntil).toLocaleDateString() : 'Permanent'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => setDeactivateDialog({ open: true, override: o })}
                            className="px-2 py-1 text-xs rounded border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="flex items-end gap-3 mb-4 bg-card rounded-lg border border-border p-4">
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1">Search Trainers</label>
              <input
                type="text"
                value={trainerSearchQuery}
                onChange={(e) => { setTrainerSearchQuery(e.target.value); setTrainersPage(1); }}
                placeholder="Search by name or email..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              />
            </div>
            {trainerSearchQuery && (
              <button
                onClick={() => { setTrainerSearchQuery(''); setTrainersPage(1); }}
                className="px-3 py-2 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
              >
                Clear
              </button>
            )}
          </div>

          {/* Trainer rate priority info */}
          <div className="bg-muted/50 rounded-lg p-3 border border-border mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Commission Priority</p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Trainer Override</span> (highest) {'>'}{' '}
              <span className="font-medium text-foreground">Org Override</span> {'>'}{' '}
              <span className="font-medium text-foreground">Custom Rate</span> {'>'}{' '}
              <span className="font-medium text-foreground">Org Rule</span> {'>'}{' '}
              <span className="font-medium text-foreground">Subscription Plan</span> {'>'}{' '}
              <span className="font-medium text-foreground">Global Rule</span> {'>'}{' '}
              <span className="font-medium text-foreground">Default 10%</span>.
              A waived trainer pays 0% until the waiver date.
            </p>
          </div>

          {/* Trainers table */}
          {trainersLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Trainer</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Organization</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Effective Rate</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Source</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trainers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                          {trainerSearchQuery ? 'No trainers match your search' : 'No trainers found'}
                        </td>
                      </tr>
                    ) : (
                      trainers.map((t) => (
                        <tr key={t.trainerId} className="bg-card hover:bg-muted/50">
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-medium">{t.trainerName}</span>
                              <p className="text-[11px] text-muted-foreground">{t.trainerEmail}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <TrainerTypeBadge type={t.trainerType || undefined} />
                          </td>
                          <td className="px-4 py-3">
                            {t.orgName ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-medium">
                                {t.orgName}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Independent</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {t.subscriptionPlan ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium">{t.subscriptionPlan}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold text-lg ${t.isWaived ? 'text-yellow-500' : 'text-primary-500'}`}>
                              {(t.effectiveRate * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <RateSourceBadge source={t.rateSource} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {t.isWaived ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                Waived until {new Date(t.commissionWaivedUntil!).toLocaleDateString()}
                              </span>
                            ) : t.hasOverride && t.override ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                  Override: {(t.override.customRate * 100).toFixed(1)}%
                                </span>
                                {t.override.validUntil && (
                                  <p className="text-[10px] text-muted-foreground">
                                    until {new Date(t.override.validUntil).toLocaleDateString()}
                                  </p>
                                )}
                                {t.override.reason && (
                                  <p className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={t.override.reason}>
                                    {t.override.reason}
                                  </p>
                                )}
                              </div>
                            ) : t.customRate != null ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                Custom: {(t.customRate * 100).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Auto</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-end flex-wrap">
                              <button
                                onClick={() => openSetRateModal(t)}
                                className="px-2 py-1 text-xs rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Set custom rate"
                              >
                                Set Rate
                              </button>
                              {t.orgId && (
                                <button
                                  onClick={() => openOrgRateModal(t)}
                                  className="px-2 py-1 text-xs rounded border border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-600 dark:text-violet-400"
                                  title="Set org-wide rate for all consultants"
                                >
                                  Org Rate
                                </button>
                              )}
                              <button
                                onClick={() => openWaiveModal(t)}
                                className="px-2 py-1 text-xs rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Waive commission"
                              >
                                Waive
                              </button>
                              {(t.customRate != null || t.isWaived || t.hasOverride) && (
                                <button
                                  onClick={() => setRemoveDialog({ open: true, trainer: t })}
                                  className="px-2 py-1 text-xs rounded border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                                  title="Remove override"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {trainersTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {trainers.length} of {trainersTotal} trainers
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setTrainersPage((p) => Math.max(1, p - 1))}
                      disabled={trainersPage <= 1}
                      className="px-3 py-1 text-sm rounded border border-border hover:bg-muted disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1 text-sm text-muted-foreground">
                      {trainersPage} / {trainersTotalPages}
                    </span>
                    <button
                      onClick={() => setTrainersPage((p) => Math.min(trainersTotalPages, p + 1))}
                      disabled={trainersPage >= trainersTotalPages}
                      className="px-3 py-1 text-sm rounded border border-border hover:bg-muted disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ═══════════════════ Tab 4: Analytics ══════════════════════════════════ */}
      {tab === 'analytics' && (
        <div>
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              {/* Commission Revenue Trend */}
              {analytics.revenueTrend.length > 0 ? (
                <LineTrend
                  title="Commission Revenue Trend"
                  subtitle="Monthly platform commission revenue"
                  data={analytics.revenueTrend}
                  color="#192C67"
                  name="Commission"
                  height={280}
                />
              ) : (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold text-card-foreground mb-1">Commission Revenue Trend</h3>
                  <p className="text-xs text-muted-foreground mb-4">Monthly platform commission revenue</p>
                  <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                    No trend data available yet
                  </div>
                </div>
              )}

              {/* Two charts side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Commission by Trainer Type */}
                {analytics.byTrainerType.length > 0 ? (
                  <DonutBreakdown
                    title="Commission by Trainer Type"
                    subtitle="White collar vs blue collar commissions"
                    data={analytics.byTrainerType}
                    height={280}
                  />
                ) : (
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold text-card-foreground mb-1">Commission by Trainer Type</h3>
                    <p className="text-xs text-muted-foreground mb-4">White collar vs blue collar commissions</p>
                    <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                      No trainer type data available
                    </div>
                  </div>
                )}

                {/* Top Earners for Platform */}
                {analytics.topEarners.length > 0 ? (
                  <BarCompare
                    title="Top Commission Earners"
                    subtitle="Trainers generating the most commission for the platform"
                    data={analytics.topEarners.slice(0, 10).map((e) => ({
                      date: e.name,
                      value: e.commissionTotal,
                    }))}
                    color="#F77B0F"
                    name="Commission"
                    height={280}
                  />
                ) : (
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold text-card-foreground mb-1">Top Commission Earners</h3>
                    <p className="text-xs text-muted-foreground mb-4">Trainers generating the most commission</p>
                    <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                      No earner data available
                    </div>
                  </div>
                )}
              </div>

              {/* Effective Rate Analysis */}
              {analytics.effectiveRateTrend.length > 0 ? (
                <LineTrend
                  title="Effective Rate Analysis"
                  subtitle="Average effective commission rate over time"
                  data={analytics.effectiveRateTrend}
                  color="#0D9488"
                  name="Rate"
                  height={260}
                />
              ) : (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold text-card-foreground mb-1">Effective Rate Analysis</h3>
                  <p className="text-xs text-muted-foreground mb-4">Average effective commission rate over time</p>
                  <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                    No rate analysis data available
                  </div>
                </div>
              )}

              {/* Top earners table */}
              {analytics.topEarners.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold text-card-foreground mb-1">Top Platform Revenue Generators</h3>
                  <p className="text-xs text-muted-foreground mb-4">Trainers who generate the most commission for the platform (by volume)</p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Trainer</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">Bookings</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">Commission Generated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {analytics.topEarners.map((e, i) => (
                          <tr key={i} className="bg-card hover:bg-muted/50">
                            <td className="px-4 py-3 text-muted-foreground font-medium">{i + 1}</td>
                            <td className="px-4 py-3 font-medium">{e.name}</td>
                            <td className="px-4 py-3">
                              <TrainerTypeBadge type={e.trainerType} />
                            </td>
                            <td className="px-4 py-3 text-right">{e.bookingCount}</td>
                            <td className="px-4 py-3 text-right font-semibold text-primary-500">
                              {formatCurrency(e.commissionTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Active Rules summary */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold text-card-foreground mb-3">Active Rules Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rules
                    .filter((r) => r.isActive)
                    .map((r) => {
                      const rate = Number(r.commissionRate ?? r.rate ?? 0);
                      return (
                        <div
                          key={r.id}
                          className="p-4 rounded-lg border border-border bg-muted/30"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{r.name}</span>
                            <span className="text-lg font-bold text-primary-500">
                              {(rate * 100).toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {ruleDescription(r)}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(Number(r.minAmount))} - {formatCurrency(Number(r.maxAmount))}
                            </span>
                            <TrainerTypeBadge type={r.trainerType} />
                            {r.subscriptionTier && (
                              <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium">
                                {r.subscriptionTier}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {rules.filter((r) => r.isActive).length === 0 && (
                    <p className="text-muted-foreground col-span-full text-sm">
                      No active rules configured
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Failed to load commission analytics
            </p>
          )}
        </div>
      )}

      {/* ═══════════════════ Create / Edit Rule Modal ══════════════════════════ */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Commission Rule' : 'Create Commission Rule'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Rule Name*</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Standard Rate, Premium Professional Rate"
              className={ic}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Commission Rate*{' '}
                <span className="text-muted-foreground font-normal">(decimal)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={form.commissionRate}
                onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) })}
                className={ic}
              />
              {form.commissionRate > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  = {(form.commissionRate * 100).toFixed(1)}% commission
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subscription Tier</label>
              <select
                value={form.subscriptionTier}
                onChange={(e) => setForm({ ...form, subscriptionTier: e.target.value })}
                className={ic}
              >
                {SUBSCRIPTION_TIERS.map((t) => (
                  <option key={t} value={t}>{t || 'All Tiers'}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Min Amount (KES)</label>
              <input
                type="number"
                min="0"
                value={form.minAmount || ''}
                onChange={(e) => setForm({ ...form, minAmount: Number(e.target.value) })}
                placeholder="0"
                className={ic}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Amount (KES)</label>
              <input
                type="number"
                min="0"
                value={form.maxAmount || ''}
                onChange={(e) => setForm({ ...form, maxAmount: Number(e.target.value) })}
                placeholder="100000"
                className={ic}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Trainer Type</label>
              <select
                value={form.trainerType}
                onChange={(e) => setForm({ ...form, trainerType: e.target.value })}
                className={ic}
              >
                {TRAINER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Organization{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                value={form.orgId}
                onChange={(e) => setForm({ ...form, orgId: e.target.value })}
                placeholder="Leave empty for Global rule"
                className={ic}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {form.orgId ? 'Org-specific rule' : 'Applies globally to all organizations'}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-border"
            />
            <span className="text-sm">Active</span>
          </label>

          {/* Rule preview */}
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Rule Preview</p>
            <p className="text-sm">
              This rule applies to{' '}
              <span className="font-medium">
                {form.trainerType === 'PROFESSIONAL'
                  ? 'Professional (White Collar)'
                  : form.trainerType === 'VOCATIONAL'
                  ? 'Vocational (Blue Collar)'
                  : 'all'}
              </span>{' '}
              trainers
              {form.orgId ? (
                <> in <span className="font-medium">a specific org</span></>
              ) : (
                ' (globally)'
              )}
              {(form.minAmount > 0 || form.maxAmount > 0) && (
                <>
                  {' '}with bookings between{' '}
                  <span className="font-medium">{formatCurrency(form.minAmount)}</span> -{' '}
                  <span className="font-medium">{formatCurrency(form.maxAmount)}</span>
                </>
              )}
              {form.subscriptionTier && (
                <>
                  {' '}on <span className="font-medium">{form.subscriptionTier}</span> plan
                </>
              )}
              {' '}at a rate of{' '}
              <span className="font-bold text-primary-500">
                {(form.commissionRate * 100).toFixed(1)}%
              </span>
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              onClick={() => {
                setModalOpen(false);
                setEditing(null);
              }}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveLoading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#192C67] hover:bg-[#0f1e47] text-white text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              {saveLoading ? 'Saving…' : editing ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={delDialog.open}
        onClose={() => setDelDialog({ open: false, rule: null })}
        onConfirm={handleDelete}
        title="Delete Commission Rule"
        message={`Are you sure you want to delete "${delDialog.rule?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={delLoading}
      />

      {/* ═══════════════════ Set Trainer Rate Modal ══════════════════════════ */}
      <Modal
        isOpen={rateModalOpen}
        onClose={() => { setRateModalOpen(false); setRateModalTrainer(null); }}
        title={`Set Custom Rate — ${rateModalTrainer?.trainerName || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          {rateModalTrainer && (
            <div className="bg-muted/50 rounded-lg p-3 border border-border text-sm">
              <p className="text-muted-foreground">
                Current rate: <span className="font-bold text-primary-500">{(rateModalTrainer.effectiveRate * 100).toFixed(1)}%</span>{' '}
                (<RateSourceBadge source={rateModalTrainer.rateSource} />)
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">
              New Commission Rate <span className="text-muted-foreground font-normal">(decimal, e.g. 0.08 = 8%)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={rateModalValue}
              onChange={(e) => setRateModalValue(e.target.value)}
              placeholder="0.10"
              className={ic}
            />
            {rateModalValue && Number(rateModalValue) > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                = {(Number(rateModalValue) * 100).toFixed(1)}% commission
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Reason <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={rateModalReason}
              onChange={(e) => setRateModalReason(e.target.value)}
              placeholder="e.g. Early adopter discount, high-volume trainer, promotional rate..."
              className={ic + ' h-20 resize-none'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Valid Until <span className="text-muted-foreground font-normal">(leave blank for permanent)</span>
            </label>
            <input
              type="date"
              value={rateModalValidUntil}
              onChange={(e) => setRateModalValidUntil(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className={ic}
            />
          </div>
          {/* Preview */}
          {rateModalTrainer && rateModalValue && Number(rateModalValue) >= 0 && (
            <div className=" rounded-lg p-3 border border-blue-200 dark:border-blue-800 text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">Preview</p>
              <p className="text-blue-700 dark:text-blue-400">
                This trainer currently pays <span className="font-bold">{(rateModalTrainer.effectiveRate * 100).toFixed(1)}%</span>.
                Setting to <span className="font-bold">{(Number(rateModalValue) * 100).toFixed(1)}%</span>
                {Number(rateModalValue) < rateModalTrainer.effectiveRate
                  ? ` will save them KES ${((rateModalTrainer.effectiveRate - Number(rateModalValue)) * 5000).toFixed(0)} per KES 5,000 booking.`
                  : Number(rateModalValue) > rateModalTrainer.effectiveRate
                  ? ` will increase platform revenue by KES ${((Number(rateModalValue) - rateModalTrainer.effectiveRate) * 5000).toFixed(0)} per KES 5,000 booking.`
                  : ' (no change).'}
                {rateModalValidUntil ? ` Expires ${new Date(rateModalValidUntil).toLocaleDateString()}.` : ' Permanent override.'}
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            This creates a commission override with the highest priority, overriding all rules and subscription plans.
          </p>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              onClick={() => { setRateModalOpen(false); setRateModalTrainer(null); }}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSetRate}
              disabled={rateModalLoading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#192C67] hover:bg-[#0f1e47] text-white text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              {rateModalLoading ? 'Saving…' : 'Set Rate'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════ Set Org Rate Modal ═════════════════════════════ */}
      <Modal
        isOpen={orgRateModalOpen}
        onClose={() => { setOrgRateModalOpen(false); setOrgRateModalTrainer(null); }}
        title={`Set Org-Wide Rate — ${orgRateModalTrainer?.orgName || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          {orgRateModalTrainer && (
            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 border border-violet-200 dark:border-violet-800 text-sm">
              <p className="text-violet-700 dark:text-violet-400">
                This rate will apply to <span className="font-bold">all consultants</span> in{' '}
                <span className="font-bold">{orgRateModalTrainer.orgName}</span> who do not have a trainer-specific override.
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">
              Org Commission Rate <span className="text-muted-foreground font-normal">(decimal, e.g. 0.08 = 8%)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={orgRateModalValue}
              onChange={(e) => setOrgRateModalValue(e.target.value)}
              placeholder="0.10"
              className={ic}
            />
            {orgRateModalValue && Number(orgRateModalValue) > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                = {(Number(orgRateModalValue) * 100).toFixed(1)}% commission
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Reason <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={orgRateModalReason}
              onChange={(e) => setOrgRateModalReason(e.target.value)}
              placeholder="e.g. Enterprise partnership agreement, volume discount..."
              className={ic + ' h-20 resize-none'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Valid Until <span className="text-muted-foreground font-normal">(leave blank for permanent)</span>
            </label>
            <input
              type="date"
              value={orgRateModalValidUntil}
              onChange={(e) => setOrgRateModalValidUntil(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className={ic}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              onClick={() => { setOrgRateModalOpen(false); setOrgRateModalTrainer(null); }}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSetOrgRate}
              disabled={orgRateModalLoading}
              className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm disabled:opacity-50 hover:bg-violet-600"
            >
              {orgRateModalLoading ? 'Saving...' : 'Set Org Rate'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════ Waive Commission Modal ══════════════════════════ */}
      <Modal
        isOpen={waiveModalOpen}
        onClose={() => { setWaiveModalOpen(false); setWaiveModalTrainer(null); }}
        title={`Waive Commission — ${waiveModalTrainer?.trainerName || ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Waive Until</label>
            <input
              type="date"
              value={waiveModalDate}
              onChange={(e) => setWaiveModalDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className={ic}
            />
          </div>
          <div className="bg-muted/50 rounded-lg p-3 border border-border text-sm">
            <p className="text-muted-foreground">
              While waived, this trainer will pay <span className="font-bold text-yellow-500">0%</span> commission on all bookings.
              The waiver expires automatically on the selected date.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              onClick={() => { setWaiveModalOpen(false); setWaiveModalTrainer(null); }}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleWaive}
              disabled={waiveModalLoading || !waiveModalDate}
              className="px-4 py-2 rounded-lg bg-yellow-500 text-white text-sm disabled:opacity-50 hover:bg-yellow-600"
            >
              {waiveModalLoading ? 'Saving...' : 'Waive Commission'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════ Remove Override Confirmation ═════════════════════ */}
      <ConfirmDialog
        isOpen={removeDialog.open}
        onClose={() => setRemoveDialog({ open: false, trainer: null })}
        onConfirm={handleRemoveOverride}
        title="Remove Commission Override"
        message={`Remove the custom rate and waiver for "${removeDialog.trainer?.trainerName}"? Their commission will revert to automatic rules (org override, org rule, plan, global rule, or default 10%).`}
        confirmLabel="Remove Override"
        confirmVariant="danger"
        loading={removeLoading}
      />

      {/* ═══════════════════ Deactivate Override Confirmation ═══════════════ */}
      <ConfirmDialog
        isOpen={deactivateDialog.open}
        onClose={() => setDeactivateDialog({ open: false, override: null })}
        onConfirm={handleDeactivateOverride}
        title="Deactivate Commission Override"
        message={`Deactivate the ${(deactivateDialog.override?.customRate ?? 0) * 100}% override for "${deactivateDialog.override?.trainerName || 'this org'}"? The affected trainer(s) will revert to the next applicable rate.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        loading={deactivateLoading}
      />
    </div>
  );
}
