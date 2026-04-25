'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { LineSeries, LineTrend, BarTrend, BarCompare, DonutBreakdown } from '@/components/Charts';
import { financialService } from '@/lib/services/financialService';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RevenueSource {
  total: number;
  count: number;
  thisMonth: number;
}

interface WalletData {
  platformWalletBalance: number;
  totalRevenue: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  growthPercentage: number;
  revenueBreakdown: {
    commissions: RevenueSource;
    subscriptions: RevenueSource;
    courseFees: RevenueSource;
    payoutFees: RevenueSource;
  };
  revenueByMonth: { month: string; commissions: number; subscriptions: number; courseFees: number; payoutFees: number }[];
}

interface MoneyFlowData {
  totalMoneyIn: number;
  totalMoneyOut: number;
  platformCut: number;
  trainerEarnings: number;
  escrowHeld: number;
  escrowReleased: number;
  escrowRefunded: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtKES = (n: number) => formatCurrency(Number(n) || 0);
const fmtCount = (n: number) => (Number(n) || 0).toLocaleString();

const BRAND = { navy: '#F77B0F', gold: '#F77B0F', teal: '#0D9488', green: '#22c55e', red: '#ef4444', sky: '#0ea5e9' };

const PERIODS = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: '1 Year', value: '1y' },
];

const SvgIcon = ({ d }: { d: string }) => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

// ── Tab type ───────────────────────────────────────────────────────────────────

type TabId = 'revenue' | 'overview' | 'money-flow';

const TABS: { id: TabId; label: string }[] = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'overview', label: 'Overview' },
  { id: 'money-flow', label: 'Money Flow' },
];

// ── Skeletons ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 animate-pulse">
      <div className="h-4 bg-muted rounded w-24 mb-3" />
      <div className="h-8 bg-muted rounded w-32" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-pulse">
      <div className="h-5 bg-muted rounded w-40 mb-4" />
      <div className="h-64 bg-muted/50 rounded" />
    </div>
  );
}

// ── Revenue Tab Components ─────────────────────────────────────────────────────

function HeroCard({ label, value, subtitle, image, badge, accentColor }: {
  label: string;
  value: string;
  subtitle?: string;
  image: string;
  badge?: { value: number; label?: string };
  accentColor?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl text-white shadow-xl min-h-[190px] flex flex-col justify-between p-6">
      {/* Background photo */}
      <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
      {/* Directional gradient: light at top, dark at bottom for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/90" />
      {/* Subtle color tint per card */}
      {accentColor && (
        <div className="absolute inset-0 opacity-15" style={{ background: `linear-gradient(135deg, ${accentColor} 0%, transparent 60%)` }} />
      )}

      {/* Label row — top */}
      <p className="relative z-10 text-[10px] font-bold uppercase tracking-[0.22em] text-white/60">{label}</p>

      {/* Value + badge — bottom */}
      <div className="relative z-10">
        <p className="text-[2.6rem] font-black leading-none tracking-tight text-white" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.7)' }}>
          {value}
        </p>
        {badge && (
          <span className={`inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm border ${
            badge.value >= 0
              ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-100'
              : 'bg-red-500/25 border-red-400/40 text-red-100'
          }`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d={badge.value >= 0 ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
            </svg>
            {badge.value >= 0 ? '+' : ''}{badge.value.toFixed(1)}% {badge.label || 'vs last month'}
          </span>
        )}
        {subtitle && !badge && (
          <p className="text-sm font-medium text-white/60 mt-1.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function SourceCard({ title, total, count, thisMonth, description, accent }: {
  title: string;
  total: number;
  count: number;
  thisMonth: number;
  description: string;
  accent: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
        <h4 className="text-sm font-semibold text-card-foreground">{title}</h4>
      </div>
      <p className="text-2xl font-bold text-card-foreground">{fmtKES(total)}</p>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-muted-foreground">{fmtCount(count)} transactions</span>
        <span className="text-xs font-medium" style={{ color: accent }}>{fmtKES(thisMonth)} this month</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2 italic">{description}</p>
    </div>
  );
}

// ── Money Flow Pipeline Components ────────────────────────────────────────────

function PipelineStage({ step, label, sub, value, baseValue, accent }: {
  step: number; label: string; sub: string; value: number; baseValue: number; accent: string;
}) {
  const pct = baseValue > 0 ? Math.min(100, Math.round((value / baseValue) * 100)) : 0;
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
      {/* Step badge */}
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 text-white shadow-sm" style={{ backgroundColor: accent }}>
        {step}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
          <span className="text-xl font-black tabular-nums text-card-foreground shrink-0">{fmtKES(value)}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: accent }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-muted-foreground">{sub}</span>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: accent }}>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

function PipelineConnector() {
  return (
    <div className="flex items-center justify-start pl-[18px] py-0.5">
      <div className="flex flex-col items-center">
        <div className="w-px h-3 bg-border" />
        <svg className="w-3.5 h-3.5 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
        <div className="w-px h-3 bg-border" />
      </div>
    </div>
  );
}

function SplitOutput({ label, value, released, accent, description }: {
  label: string; value: number; released: number; accent: string; description: string;
}) {
  const pct = released > 0 ? Math.min(100, Math.round((value / released) * 100)) : 0;
  return (
    <div className="flex-1 p-4 rounded-xl border border-border bg-card min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">{label}</p>
      <p className="text-2xl font-black tabular-nums text-card-foreground leading-none">{fmtKES(value)}</p>
      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-muted-foreground">{description}</span>
        <span className="text-[11px] font-bold" style={{ color: accent }}>{pct}% of released</span>
      </div>
    </div>
  );
}

function MoneyFlowDiagram({ moneyFlow }: { moneyFlow: MoneyFlowData }) {
  const base = Math.max(moneyFlow.totalMoneyIn, 1);

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-card-foreground">Cash Flow Pipeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">How money moves through the Uteo platform</p>
        </div>
        {(Number(moneyFlow.escrowRefunded) || 0) > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-1.5 shrink-0">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Refunded: {fmtKES(moneyFlow.escrowRefunded)}
          </div>
        )}
      </div>

      {/* Pipeline steps */}
      <div>
        <PipelineStage
          step={1} label="Client Deposits" sub="Total collected from bookings"
          value={moneyFlow.totalMoneyIn} baseValue={base} accent={BRAND.navy}
        />
        <PipelineConnector />
        <PipelineStage
          step={2} label="Escrow Held" sub="Awaiting session confirmation"
          value={moneyFlow.escrowHeld} baseValue={base} accent="#6366f1"
        />
        <PipelineConnector />
        <PipelineStage
          step={3} label="Escrow Released" sub="Sessions confirmed complete"
          value={moneyFlow.escrowReleased} baseValue={base} accent={BRAND.teal}
        />

        {/* Split divider */}
        <div className="flex items-center gap-3 my-4 pl-[18px]">
          <div className="w-px h-5 bg-border self-start mt-0.5" />
          <div className="flex-1 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">distributed as</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </div>

        {/* Split outputs */}
        <div className="flex gap-3">
          <SplitOutput
            label="Trainer Earnings"
            value={moneyFlow.trainerEarnings}
            released={moneyFlow.escrowReleased}
            accent={BRAND.green}
            description="paid to trainers"
          />
          <SplitOutput
            label="Platform Cut"
            value={moneyFlow.platformCut}
            released={moneyFlow.escrowReleased}
            accent={BRAND.gold}
            description="platform revenue"
          />
        </div>
      </div>

      {/* Summary footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Total In</p>
          <p className="text-base font-black tabular-nums text-card-foreground">{fmtKES(moneyFlow.totalMoneyIn)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Total Out</p>
          <p className="text-base font-black tabular-nums text-card-foreground">{fmtKES(moneyFlow.totalMoneyOut)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Platform Take</p>
          <p className="text-base font-black tabular-nums" style={{ color: BRAND.gold }}>{fmtKES(moneyFlow.platformCut)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Net to Trainers</p>
          <p className="text-base font-black tabular-nums" style={{ color: BRAND.green }}>{fmtKES(moneyFlow.trainerEarnings)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Page Component ─────────────────────────────────────────────────────────────

export default function FinancialsPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('revenue');

  // ── Revenue tab state ──────────────────────────────────────────────────────
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [moneyFlow, setMoneyFlow] = useState<MoneyFlowData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);

  // ── Overview tab state ─────────────────────────────────────────────────────
  const [period, setPeriod] = useState('30d');
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any>(null);
  const [payouts, setPayouts] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any>(null);
  const [recentPayouts, setRecentPayouts] = useState<any[]>([]);

  // ── Revenue tab fetch ──────────────────────────────────────────────────────
  const fetchRevenueData = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const [w, mf] = await Promise.all([
        financialService.platformWallet(),
        financialService.platformMoneyFlow(),
      ]);
      setWallet(w);
      setMoneyFlow(mf);
    } catch {
      addToast('error', 'Failed to load revenue data');
    } finally {
      setRevenueLoading(false);
    }
  }, [addToast]);

  // ── Overview tab fetch ─────────────────────────────────────────────────────
  const fetchOverviewData = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const [sum, rev, comm, pay, subs, recent] = await Promise.all([
        financialService.platformSummary(period).catch(() => null),
        financialService.platformRevenue(period, 'day').catch(() => []),
        financialService.platformCommissions(period).catch(() => null),
        financialService.platformPayouts(period).catch(() => null),
        financialService.platformSubscriptions().catch(() => null),
        financialService.payoutQueue({ limit: 10, page: 1 }).catch(() => null),
      ]);
      setSummary(sum);
      setRevenue(Array.isArray(rev) ? rev : rev?.data || rev?.items || []);
      setCommissions(comm);
      setPayouts(pay);
      setSubscriptions(subs);
      setRecentPayouts(Array.isArray(recent) ? recent : recent?.items || []);
    } catch {
      addToast('error', 'Failed to load financial data');
    } finally {
      setOverviewLoading(false);
    }
  }, [period, addToast]);

  // ── Effects: fetch data when tabs become active ────────────────────────────
  useEffect(() => {
    if (activeTab === 'revenue' || activeTab === 'money-flow') fetchRevenueData();
  }, [activeTab, fetchRevenueData]);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverviewData();
  }, [activeTab, fetchOverviewData]);

  // ── Derived: Revenue tab data ──────────────────────────────────────────────
  const rb = wallet?.revenueBreakdown;

  const trendData = (wallet?.revenueByMonth || []).map((m) => ({
    month: m.month,
    commissions: Number(m.commissions) || 0,
    subscriptions: Number(m.subscriptions) || 0,
    courseFees: Number(m.courseFees) || 0,
    payoutFees: Number(m.payoutFees) || 0,
  }));

  const trendSeries = [
    { key: 'commissions',   name: 'Commissions',    color: '#7C3AED' },
    { key: 'subscriptions', name: 'Subscriptions',  color: '#F59E0B' },
    { key: 'courseFees',    name: 'Course Fees',    color: '#10B981' },
    { key: 'payoutFees',    name: 'Payout Fees',    color: '#F43F5E' },
  ];

  const donutData = rb ? [
    { name: 'Commissions', value: Number(rb.commissions?.total) || 0 },
    { name: 'Subscriptions', value: Number(rb.subscriptions?.total) || 0 },
    { name: 'Course Fees', value: Number(rb.courseFees?.total) || 0 },
    { name: 'Payout Fees', value: Number(rb.payoutFees?.total) || 0 },
  ] : [];

  const monthlyRows = trendData.map((m, i) => {
    const total = m.commissions + m.subscriptions + m.courseFees + m.payoutFees;
    const prev = i > 0 ? trendData[i - 1] : null;
    const prevTotal = prev ? (prev.commissions + prev.subscriptions + prev.courseFees + prev.payoutFees) : 0;
    const change = prev && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
    return { ...m, total, change };
  });

  // ── Derived: Overview tab data ─────────────────────────────────────────────
  const totalRevenue = Number(summary?.totalRevenue || summary?.revenue || 0);
  const totalCommissions = Number(summary?.totalCommissions || summary?.commissions || 0);
  const payoutsProcessed = Number(summary?.payoutsProcessed || summary?.payoutsCompleted || 0);
  const pendingPayouts = Number(summary?.pendingPayouts || summary?.payoutsPending || 0);
  const netRevenue = Number(summary?.netRevenue || totalRevenue - payoutsProcessed);
  const mrr = Number(subscriptions?.mrr || subscriptions?.monthlyRecurringRevenue || 0);
  const revenueGrowth = Number(summary?.revenueGrowth || summary?.growth || 0);
  const commissionGrowth = Number(summary?.commissionGrowth || 0);

  const revenueTrendData = revenue.map((r: any) => ({
    date: r.date || r.period || r.label || '',
    value: Number(r.revenue || r.amount || r.value || 0),
  }));

  const commissionBreakdown: { name: string; value: number }[] = Array.isArray(commissions?.breakdown || commissions?.byRule || commissions?.data)
    ? (commissions?.breakdown || commissions?.byRule || commissions?.data).map((c: any) => ({
        name: c.rule || c.name || c.trainer || c.label || 'Other',
        value: Number(c.amount || c.value || 0),
      }))
    : [];

  const payoutByMethod: { date: string; value: number }[] = Array.isArray(payouts?.byMethod || payouts?.data)
    ? (payouts?.byMethod || payouts?.data).map((p: any) => ({
        date: p.method || p.name || p.label || '',
        value: Number(p.amount || p.value || p.total || 0),
      }))
    : [];

  const subPlans: any[] = Array.isArray(subscriptions?.plans || subscriptions?.data)
    ? subscriptions?.plans || subscriptions?.data
    : [];
  const churnRate = Number(subscriptions?.churnRate || 0);

  return (
    <div>
      <PageHeader
        title="Financials"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Financials' },
        ]}
      />
      <p className="text-muted-foreground -mt-4 mb-6 text-sm">Uteo&apos;s earnings, revenue sources, and money flow</p>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-muted-foreground hover:text-card-foreground hover:border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================
         REVENUE TAB
         ================================================================ */}
      {activeTab === 'revenue' && (
        <>
          {revenueLoading ? (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="rounded-2xl p-6 h-36 animate-pulse bg-muted/60" />
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="rounded-xl border border-border p-5 h-32 animate-pulse bg-card" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="rounded-xl border border-border p-6 h-96 animate-pulse bg-card" />
                <div className="rounded-xl border border-border p-6 h-96 animate-pulse bg-card" />
              </div>
            </div>
          ) : !wallet ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" /></svg>
              </div>
              <p className="text-muted-foreground mb-4">Revenue data unavailable</p>
            </div>
          ) : (
            <>
              {/* 1. Hero KPI Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
                <HeroCard
                  label="Platform Wallet Balance"
                  value={fmtKES(wallet.platformWalletBalance)}
                  subtitle="Available funds"
                  accentColor="#F77B0F"
                  image="https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80"
                />
                <HeroCard
                  label="Total Revenue — All Time"
                  value={fmtKES(wallet.totalRevenue)}
                  subtitle="Since launch"
                  accentColor="#0D9488"
                  image="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80"
                />
                <HeroCard
                  label="This Month Revenue"
                  value={fmtKES(wallet.thisMonthRevenue)}
                  badge={{ value: Number(wallet.growthPercentage) || 0 }}
                  accentColor="#F77B0F"
                  image="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80"
                />
                <HeroCard
                  label="Money In Transit"
                  value={fmtKES(moneyFlow?.escrowHeld || 0)}
                  subtitle="Held in escrow"
                  accentColor="#6366f1"
                  image="https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80"
                />
              </div>

              {/* 2. Revenue Sources */}
              <h2 className="text-lg font-bold text-card-foreground mb-4">Revenue Sources</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
                <SourceCard
                  title="Booking Commissions"
                  total={Number(rb?.commissions?.total) || 0}
                  count={Number(rb?.commissions?.count) || 0}
                  thisMonth={Number(rb?.commissions?.thisMonth) || 0}
                  description="From escrow releases"
                  accent={BRAND.navy}
                />
                <SourceCard
                  title="Subscription Revenue"
                  total={Number(rb?.subscriptions?.total) || 0}
                  count={Number(rb?.subscriptions?.count) || 0}
                  thisMonth={Number(rb?.subscriptions?.thisMonth) || 0}
                  description="100% platform revenue"
                  accent={BRAND.gold}
                />
                <SourceCard
                  title="Course Fees"
                  total={Number(rb?.courseFees?.total) || 0}
                  count={Number(rb?.courseFees?.count) || 0}
                  thisMonth={Number(rb?.courseFees?.thisMonth) || 0}
                  description="10% of course sales"
                  accent={BRAND.teal}
                />
                <SourceCard
                  title="Payout Fees"
                  total={Number(rb?.payoutFees?.total) || 0}
                  count={Number(rb?.payoutFees?.count) || 0}
                  thisMonth={Number(rb?.payoutFees?.thisMonth) || 0}
                  description="1.5% M-Pesa / 0.5% bank"
                  accent={BRAND.sky}
                />
              </div>

              {/* 3. Charts Row: Revenue Trend + Donut */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
                <LineSeries
                  title="Revenue Trend"
                  subtitle="Monthly revenue by source (last 6 months)"
                  data={trendData}
                  series={trendSeries}
                  xKey="month"
                  height={320}
                />
                <DonutBreakdown
                  title="Revenue Breakdown"
                  subtitle="Proportion of each revenue source"
                  data={donutData}
                  colors={['#7C3AED', '#F59E0B', '#10B981', '#F43F5E']}
                  height={320}
                />
              </div>

              {/* 4. Money Flow Diagram (compact preview) */}
              {moneyFlow && <MoneyFlowDiagram moneyFlow={moneyFlow} />}

              {/* 5. Monthly Performance Table */}
              <h2 className="text-lg font-bold text-card-foreground mb-4 mt-10">Monthly Performance</h2>
              <div className="bg-card rounded-xl border border-border overflow-hidden mb-8">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Month</th>
                        <th className="text-right px-6 py-3 font-semibold text-muted-foreground">Commissions</th>
                        <th className="text-right px-6 py-3 font-semibold text-muted-foreground">Subscriptions</th>
                        <th className="text-right px-6 py-3 font-semibold text-muted-foreground">Course Fees</th>
                        <th className="text-right px-6 py-3 font-semibold text-muted-foreground">Payout Fees</th>
                        <th className="text-right px-6 py-3 font-semibold text-muted-foreground">Total</th>
                        <th className="text-right px-6 py-3 font-semibold text-muted-foreground">vs Prev</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRows.map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-3 font-medium text-card-foreground">{row.month}</td>
                          <td className="px-6 py-3 text-right text-card-foreground">{fmtKES(row.commissions)}</td>
                          <td className="px-6 py-3 text-right text-card-foreground">{fmtKES(row.subscriptions)}</td>
                          <td className="px-6 py-3 text-right text-card-foreground">{fmtKES(row.courseFees)}</td>
                          <td className="px-6 py-3 text-right text-card-foreground">{fmtKES(row.payoutFees)}</td>
                          <td className="px-6 py-3 text-right font-bold text-card-foreground">{fmtKES(row.total)}</td>
                          <td className="px-6 py-3 text-right">
                            {row.change !== null ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold ${row.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {row.change >= 0 ? '+' : ''}{row.change.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">--</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {monthlyRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No monthly data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ================================================================
         OVERVIEW TAB
         ================================================================ */}
      {activeTab === 'overview' && (
        <>
          {/* Period Selector */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit mb-6">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  period === p.value
                    ? 'bg-card text-card-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-card-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* KPI Row */}
          {overviewLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              <StatsCard
                label="Total Revenue"
                value={formatCurrency(totalRevenue)}
                icon={<SvgIcon d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" />}
                trend={revenueGrowth ? { value: revenueGrowth, isUp: revenueGrowth > 0 } : undefined}
              />
              <StatsCard
                label="Platform Commissions"
                value={formatCurrency(totalCommissions)}
                icon={<SvgIcon d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />}
                trend={commissionGrowth ? { value: commissionGrowth, isUp: commissionGrowth > 0 } : undefined}
              />
              <StatsCard
                label="Payouts Processed"
                value={formatCurrency(payoutsProcessed)}
                icon={<SvgIcon d="M13 7l5 5m0 0l-5 5m5-5H6" />}
              />
              <StatsCard
                label="Pending Payouts"
                value={formatCurrency(pendingPayouts)}
                icon={<SvgIcon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
              />
              <StatsCard
                label="Net Revenue"
                value={formatCurrency(netRevenue)}
                icon={<SvgIcon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
              />
              <StatsCard
                label="Subscriptions MRR"
                value={formatCurrency(mrr)}
                icon={<SvgIcon d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />}
              />
            </div>
          )}

          {/* Charts Row */}
          {overviewLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <SkeletonChart />
              <SkeletonChart />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <BarTrend
                title="Revenue Trend"
                subtitle={`Revenue over the last ${period}`}
                data={revenueTrendData}
                color="#7C3AED"
                name="Revenue"
              />
              <DonutBreakdown
                title="Commission Breakdown"
                subtitle="Commissions by rule or trainer"
                data={commissionBreakdown.length > 0 ? commissionBreakdown : [{ name: 'No data', value: 1 }]}
                colors={['#7C3AED', '#F43F5E', '#F59E0B', '#06B6D4', '#10B981', '#FB923C']}
              />
            </div>
          )}

          {/* Payout Summary */}
          {overviewLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <SkeletonChart />
              <SkeletonChart />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <BarCompare
                title="Payouts by Method"
                subtitle="M-Pesa vs Bank vs Other"
                data={payoutByMethod}
                color="#F43F5E"
                name="Amount"
              />
              {/* Subscription Revenue Section */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold text-card-foreground mb-1">Subscription Revenue</h3>
                <p className="text-xs text-muted-foreground mb-4">Plan breakdown and MRR</p>
                {subPlans.length > 0 ? (
                  <>
                    <div className="overflow-x-auto rounded-lg border border-border mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted">
                            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Plan</th>
                            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Subscribers</th>
                            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {subPlans.map((plan: any, idx: number) => (
                            <tr key={idx} className="bg-card">
                              <td className="px-4 py-2 font-medium">{plan.name || plan.plan || 'Unknown'}</td>
                              <td className="px-4 py-2 text-right text-muted-foreground">{plan.subscribers || plan.count || 0}</td>
                              <td className="px-4 py-2 text-right font-medium">{formatCurrency(Number(plan.revenue || plan.amount || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">MRR: </span>
                        <span className="font-semibold">{formatCurrency(mrr)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Churn Rate: </span>
                        <span className={`font-semibold ${churnRate > 5 ? 'text-red-500' : 'text-green-500'}`}>
                          {churnRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                    No subscription data available
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Payouts Mini-table */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-card-foreground">Recent Payouts</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Last 10 payout requests</p>
              </div>
              <a href="/dashboard/payments?tab=payouts" className="text-sm font-medium text-primary-500 hover:underline">
                View all
              </a>
            </div>
            {overviewLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : recentPayouts.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Trainer</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Method</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentPayouts.slice(0, 10).map((p: any, idx: number) => (
                      <tr key={p.id || idx} className="bg-card hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-2.5 font-medium">
                          {p.user?.firstName || p.trainer?.firstName || ''}{' '}
                          {p.user?.lastName || p.trainer?.lastName || ''}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium">
                          {formatCurrency(Number(p.amount || 0))}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {p.method || p.paymentMethod || '--'}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={p.status || 'PENDING'} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {p.createdAt ? formatDate(p.createdAt) : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No recent payouts
              </div>
            )}
          </div>
        </>
      )}

      {/* ================================================================
         MONEY FLOW TAB
         ================================================================ */}
      {activeTab === 'money-flow' && (
        <>
          {revenueLoading ? (
            <div className="space-y-6">
              <SkeletonChart />
              <SkeletonChart />
            </div>
          ) : !moneyFlow ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
              <p className="text-muted-foreground mb-4">Money flow data unavailable</p>
            </div>
          ) : (
            <>
              {/* Summary KPI cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatsCard
                  label="Total Money In"
                  value={fmtKES(moneyFlow.totalMoneyIn)}
                  icon={<SvgIcon d="M12 6v6m0 0v6m0-6h6m-6 0H6" />}
                />
                <StatsCard
                  label="Total Money Out"
                  value={fmtKES(moneyFlow.totalMoneyOut)}
                  icon={<SvgIcon d="M13 7l5 5m0 0l-5 5m5-5H6" />}
                />
                <StatsCard
                  label="Escrow Held"
                  value={fmtKES(moneyFlow.escrowHeld)}
                  icon={<SvgIcon d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />}
                />
                <StatsCard
                  label="Escrow Released"
                  value={fmtKES(moneyFlow.escrowReleased)}
                  icon={<SvgIcon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                />
              </div>

              {/* Full money flow diagram */}
              <MoneyFlowDiagram moneyFlow={moneyFlow} />

              {/* Detailed breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold text-card-foreground mb-4">Inflow vs Outflow</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Money In</span>
                        <span className="font-medium text-card-foreground">{fmtKES(moneyFlow.totalMoneyIn)}</span>
                      </div>
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: BRAND.navy }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Money Out</span>
                        <span className="font-medium text-card-foreground">{fmtKES(moneyFlow.totalMoneyOut)}</span>
                      </div>
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: moneyFlow.totalMoneyIn > 0 ? `${(moneyFlow.totalMoneyOut / moneyFlow.totalMoneyIn) * 100}%` : '0%',
                            backgroundColor: BRAND.teal,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Platform Cut</span>
                        <span className="font-medium" style={{ color: BRAND.gold }}>{fmtKES(moneyFlow.platformCut)}</span>
                      </div>
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: moneyFlow.totalMoneyIn > 0 ? `${(moneyFlow.platformCut / moneyFlow.totalMoneyIn) * 100}%` : '0%',
                            backgroundColor: BRAND.gold,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold text-card-foreground mb-4">Distribution Split</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BRAND.green }} />
                        <span className="text-sm text-card-foreground">Trainer Earnings</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: BRAND.green }}>{fmtKES(moneyFlow.trainerEarnings)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BRAND.gold }} />
                        <span className="text-sm text-card-foreground">Platform Revenue</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: BRAND.gold }}>{fmtKES(moneyFlow.platformCut)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#6366F1' }} />
                        <span className="text-sm text-card-foreground">Still in Escrow</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: '#6366F1' }}>{fmtKES(moneyFlow.escrowHeld)}</span>
                    </div>
                    {(Number(moneyFlow.escrowRefunded) || 0) > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/10">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BRAND.red }} />
                          <span className="text-sm text-red-700 dark:text-red-400">Refunded</span>
                        </div>
                        <span className="text-sm font-bold text-red-600 dark:text-red-400">{fmtKES(moneyFlow.escrowRefunded)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
