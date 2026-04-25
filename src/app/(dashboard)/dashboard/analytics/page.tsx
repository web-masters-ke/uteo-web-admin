'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { LineTrend, BarCompare, DonutBreakdown, LineSeries, BarTrend } from '@/components/Charts';
import { analyticsService, TopTrainer, CategoryBreakdown } from '@/lib/services/analyticsService';
import { applicationAdminService } from '@/lib/services/applicationAdminService';
import { jobService } from '@/lib/services/jobService';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatNumber } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d' | '1y';

interface OverviewData {
  totalUsers: number;
  totalTrainers: number;
  totalClients: number;
  totalBookings: number;
  totalRevenue: number;
  activeDisputes: number;
  pendingVerifications: number;
}

interface RevenueData {
  data: { date: string; revenue: number; amount?: number; value?: number }[];
  total: number;
  growth: number;
}

interface BookingsData {
  byStatus: { status: string; count: number }[];
  trend: { date: string; count: number; value?: number }[];
}

interface UsersData {
  trend: { date: string; clients: number; trainers: number }[];
  byRole: { role: string; count: number }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS: { label: string; value: Period }[] = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: '1 Year', value: '1y' },
];

const BRAND = {
  navy: '#F77B0F',
  gold: '#F77B0F',
  teal: '#0D9488',
  green: '#22c55e',
  red: '#ef4444',
  sky: '#0ea5e9',
  purple: '#8B5CF6',
  pink: '#EC4899',
};

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: BRAND.teal,
  CONFIRMED: BRAND.navy,
  CANCELLED: BRAND.red,
  DISPUTED: BRAND.gold,
  PENDING: BRAND.sky,
};

const KPI_IMAGES = {
  users: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
  trainers: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80',
  clients: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
  bookings: 'https://images.unsplash.com/photo-1573497019236-61e7a0081f95?auto=format&fit=crop&w=800&q=80',
  revenue: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=800&q=80',
  alerts: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtKES = (n: number) => formatCurrency(Number(n) || 0);

function safeArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object' && 'data' in (val as Record<string, unknown>)) {
    const inner = (val as Record<string, unknown>).data;
    if (Array.isArray(inner)) return inner;
  }
  if (val && typeof val === 'object' && 'items' in (val as Record<string, unknown>)) {
    const inner = (val as Record<string, unknown>).items;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

function renderStars(rating: number): React.ReactNode {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: full }, (_, i) => (
        <svg key={`f${i}`} className="w-3.5 h-3.5 text-[#F77B0F]" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {half && (
        <svg className="w-3.5 h-3.5 text-[#F77B0F]" fill="currentColor" viewBox="0 0 20 20">
          <defs>
            <linearGradient id="halfStar">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="var(--muted)" />
            </linearGradient>
          </defs>
          <path fill="url(#halfStar)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )}
      {Array.from({ length: empty }, (_, i) => (
        <svg key={`e${i}`} className="w-3.5 h-3.5 text-muted" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </span>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroKpiCard({ label, value, subtitle, image, badge, onClick }: {
  label: string;
  value: string;
  subtitle?: string;
  image: string;
  badge?: { value: number; label?: string };
  onClick?: () => void;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-xl min-h-[160px] ${onClick ? 'cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all' : ''}`}
      onClick={onClick}
    >
      <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/65" />
      <div className="relative z-10">
        <p className="text-xs font-bold uppercase tracking-wider text-white/90 drop-shadow-lg">{label}</p>
        <p className="text-3xl font-black mt-2 tracking-tight text-white drop-shadow-xl" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{value}</p>
        {badge && (
          <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-bold ${badge.value >= 0 ? 'bg-green-500/30 text-green-100 backdrop-blur-sm' : 'bg-red-500/30 text-red-100 backdrop-blur-sm'}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={badge.value >= 0 ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
            </svg>
            {badge.value >= 0 ? '+' : ''}{badge.value.toFixed(1)}% {badge.label || 'growth'}
          </span>
        )}
        {subtitle && !badge && <p className="text-sm font-semibold text-white/80 mt-2 drop-shadow-md">{subtitle}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold text-card-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

// ── Skeleton Components ───────────────────────────────────────────────────────

function SkeletonKpiRow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="rounded-2xl h-[160px] animate-pulse bg-muted/60" />
      ))}
    </div>
  );
}

function SkeletonChart({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-card rounded-xl border border-border p-6 animate-pulse ${className}`}>
      <div className="h-5 bg-muted rounded w-40 mb-2" />
      <div className="h-3 bg-muted rounded w-60 mb-6" />
      <div className="h-[280px] bg-muted/40 rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-pulse">
      <div className="h-5 bg-muted rounded w-52 mb-2" />
      <div className="h-3 bg-muted rounded w-72 mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-12 bg-muted/40 rounded" />
        ))}
      </div>
    </div>
  );
}

// ── Page Component ────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [period, setPeriod] = useState<Period>('30d');

  // Data states
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [bookingsData, setBookingsData] = useState<BookingsData | null>(null);
  const [usersData, setUsersData] = useState<UsersData | null>(null);
  const [topTrainers, setTopTrainers] = useState<TopTrainer[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);

  // Recruitment analytics state
  const [recruitmentLoading, setRecruitmentLoading] = useState(true);
  const [recruitmentFunnel, setRecruitmentFunnel] = useState<{ name: string; value: number }[]>([]);
  const [topSkills, setTopSkills] = useState<{ date: string; value: number }[]>([]);
  const [jobTypeBreakdown, setJobTypeBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [appsPerDay, setAppsPerDay] = useState<{ date: string; value: number }[]>([]);

  // Loading states
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);

  // Fetch overview (doesn't depend on period)
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const data = await analyticsService.overview().catch(() => null);
      if (data) setOverview(data);
      else {
        // Fallback to dashboard endpoint
        const dash = await analyticsService.getDashboard();
        setOverview({
          totalUsers: dash.totalUsers,
          totalTrainers: dash.totalTrainers,
          totalClients: dash.totalUsers - dash.totalTrainers,
          totalBookings: dash.totalBookings,
          totalRevenue: Number(dash.totalRevenue) || 0,
          activeDisputes: dash.activeDisputes || 0,
          pendingVerifications: dash.pendingVerifications || 0,
        });
      }
    } catch {
      addToast('error', 'Failed to load overview data');
    } finally {
      setOverviewLoading(false);
    }
  }, [addToast]);

  // Fetch period-dependent data
  const fetchCharts = useCallback(async () => {
    setChartsLoading(true);
    try {
      const [revRaw, bookRaw, usrRaw, topRaw, catRaw] = await Promise.all([
        analyticsService.revenue(period).catch(() => null),
        analyticsService.bookings(period).catch(() => null),
        analyticsService.users(period).catch(() => null),
        analyticsService.topTrainers(10).catch(() => []),
        analyticsService.categories().catch(() => []),
      ]);

      // Normalize revenue data
      if (revRaw) {
        const items = safeArray<any>(revRaw.data || revRaw.trend || revRaw.items || revRaw);
        setRevenueData({
          data: items.map((d: any) => ({
            date: d.date || d.period || d.label || '',
            revenue: Number(d.revenue || d.amount || d.value || d.total || 0),
          })),
          total: Number(revRaw.total || revRaw.totalRevenue || 0),
          growth: Number(revRaw.growth || revRaw.growthPercentage || 0),
        });
      }

      // Normalize bookings data
      if (bookRaw) {
        const statusArr = safeArray<any>(bookRaw.byStatus || bookRaw.statusBreakdown || bookRaw.statuses || []);
        const trendArr = safeArray<any>(bookRaw.trend || bookRaw.data || bookRaw.items || []);
        setBookingsData({
          byStatus: statusArr.map((s: any) => ({
            status: s.status || s.name || s.label || 'Unknown',
            count: Number(s.count || s.value || s.total || 0),
          })),
          trend: trendArr.map((t: any) => ({
            date: t.date || t.period || t.label || '',
            count: Number(t.count || t.value || t.bookings || t.total || 0),
          })),
        });
      }

      // Normalize users data
      if (usrRaw) {
        const trendArr = safeArray<any>(usrRaw.trend || usrRaw.data || usrRaw.signups || usrRaw.items || []);
        const roleArr = safeArray<any>(usrRaw.byRole || usrRaw.roles || usrRaw.roleBreakdown || []);
        setUsersData({
          trend: trendArr.map((t: any) => ({
            date: t.date || t.period || t.label || '',
            clients: Number(t.clients || t.CLIENT || 0),
            trainers: Number(t.trainers || t.TRAINER || 0),
          })),
          byRole: roleArr.map((r: any) => ({
            role: r.role || r.name || r.label || 'Unknown',
            count: Number(r.count || r.value || r.total || 0),
          })),
        });
      }

      setTopTrainers(Array.isArray(topRaw) ? topRaw : safeArray(topRaw));
      setCategories(Array.isArray(catRaw) ? catRaw : safeArray(catRaw));
    } catch {
      addToast('error', 'Failed to load analytics charts');
    } finally {
      setChartsLoading(false);
    }
  }, [period, addToast]);

  // Fetch recruitment analytics
  const fetchRecruitmentAnalytics = useCallback(async () => {
    setRecruitmentLoading(true);
    try {
      const [appsData, jobsData] = await Promise.all([
        applicationAdminService.list({ limit: 200 }).catch(() => ({ items: [], total: 0 })),
        jobService.list({ limit: 200 }).catch(() => ({ items: [], total: 0 })),
      ]);

      const apps = (appsData as any).items ?? [];
      const jobs = (jobsData as any).items ?? [];

      // Build recruitment funnel
      const statusCounts: Record<string, number> = {
        PENDING: 0, UNDER_REVIEW: 0, REVIEWED: 0, SHORTLISTED: 0, HIRED: 0,
      };
      apps.forEach((a: any) => {
        if (a.status in statusCounts) statusCounts[a.status]++;
      });
      setRecruitmentFunnel([
        { name: 'Submitted', value: apps.length },
        { name: 'Reviewed', value: (statusCounts.UNDER_REVIEW || 0) + (statusCounts.REVIEWED || 0) },
        { name: 'Shortlisted', value: statusCounts.SHORTLISTED || 0 },
        { name: 'Hired', value: statusCounts.HIRED || 0 },
      ]);

      // Job type breakdown
      const typeCounts: Record<string, number> = {};
      jobs.forEach((j: any) => {
        const t = j.jobType || 'UNKNOWN';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });
      setJobTypeBreakdown(Object.entries(typeCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })));

      // Top skills from jobs
      const skillCounts: Record<string, number> = {};
      jobs.forEach((j: any) => {
        (j.skills || []).forEach((s: string) => {
          skillCounts[s] = (skillCounts[s] || 0) + 1;
        });
      });
      const sortedSkills = Object.entries(skillCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, value]) => ({ date: name.length > 14 ? name.slice(0, 14) + '..' : name, value }));
      setTopSkills(sortedSkills);

      // Applications per day (last 30 days)
      const dayMap: Record<string, number> = {};
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dayMap[d.toISOString().slice(5, 10)] = 0;
      }
      apps.forEach((a: any) => {
        const key = (a.appliedAt || a.createdAt || '').slice(5, 10);
        if (key in dayMap) dayMap[key]++;
      });
      setAppsPerDay(Object.entries(dayMap).map(([date, value]) => ({ date, value })));
    } catch {
      // silently ignore
    } finally {
      setRecruitmentLoading(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchCharts(); }, [fetchCharts]);
  useEffect(() => { fetchRecruitmentAnalytics(); }, [fetchRecruitmentAnalytics]);

  // ── Derived chart data ──────────────────────────────────────────────────────

  // Revenue trend for LineTrend
  const revenueTrendChart = (revenueData?.data || []).map((d) => ({
    date: d.date.length > 7 ? d.date.slice(5) : d.date,
    value: d.revenue,
  }));

  // Bookings by status for DonutBreakdown
  const bookingStatusDonut = (bookingsData?.byStatus || [])
    .filter((s) => s.count > 0)
    .map((s) => ({ name: s.status, value: s.count }));

  // Bookings trend for LineTrend
  const bookingsTrendChart = (bookingsData?.trend || []).map((t) => ({
    date: t.date.length > 7 ? t.date.slice(5) : t.date,
    value: t.count,
  }));

  // User signups for LineSeries
  const userSignupSeries = (usersData?.trend || []).map((t) => ({
    date: t.date.length > 7 ? t.date.slice(5) : t.date,
    clients: t.clients,
    trainers: t.trainers,
  }));

  // User role distribution for DonutBreakdown
  const userRoleDonut = (usersData?.byRole || [])
    .filter((r) => r.count > 0)
    .map((r) => ({ name: r.role, value: r.count }));

  // Top trainers bar chart
  const trainerRevenueBar = topTrainers.slice(0, 10).map((t) => ({
    date: t.name.split(' ')[0],
    value: t.totalRevenue,
  }));

  // Categories bar chart
  const categoryBookingsBar = categories.map((c) => ({
    date: c.name.length > 12 ? c.name.slice(0, 12) + '..' : c.name,
    value: c.bookings,
  }));

  // Computed KPIs
  const completionRate = overview && overview.totalBookings > 0
    ? ((bookingsData?.byStatus?.find((s) => s.status === 'COMPLETED')?.count || 0) / overview.totalBookings * 100)
    : 0;

  const alertCount = (overview?.activeDisputes || 0) + (overview?.pendingVerifications || 0);

  return (
    <div>
      <PageHeader
        title="Analytics"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics' }]}
      />
      <p className="text-muted-foreground -mt-4 mb-6 text-sm">
        Platform performance, user growth, and revenue insights
      </p>

      {/* ── Period Selector ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit mb-8">
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

      {/* ── KPI Hero Row ─────────────────────────────────────────────────────── */}
      {overviewLoading ? (
        <SkeletonKpiRow />
      ) : overview ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
          <HeroKpiCard
            label="Total Users"
            value={formatNumber(overview.totalUsers)}
            badge={revenueData ? { value: revenueData.growth, label: 'period growth' } : undefined}
            image={KPI_IMAGES.users}
          />
          <HeroKpiCard
            label="Total Trainers"
            value={formatNumber(overview.totalTrainers)}
            subtitle={`${overview.totalClients > 0 ? formatNumber(overview.totalClients) + ' clients' : 'Pro + Vocational'}`}
            image={KPI_IMAGES.trainers}
            onClick={() => router.push('/dashboard/trainers')}
          />
          <HeroKpiCard
            label="Total Clients"
            value={formatNumber(overview.totalClients)}
            subtitle="Active learners"
            image={KPI_IMAGES.clients}
          />
          <HeroKpiCard
            label="Total Bookings"
            value={formatNumber(overview.totalBookings)}
            subtitle={completionRate > 0 ? `${completionRate.toFixed(0)}% completion rate` : undefined}
            image={KPI_IMAGES.bookings}
          />
          <HeroKpiCard
            label="Total Revenue"
            value={fmtKES(overview.totalRevenue)}
            badge={revenueData?.growth ? { value: revenueData.growth, label: 'vs prev period' } : undefined}
            image={KPI_IMAGES.revenue}
            onClick={() => router.push('/dashboard/financials')}
          />
          <HeroKpiCard
            label="Alerts"
            value={String(alertCount)}
            subtitle={`${overview.activeDisputes} disputes / ${overview.pendingVerifications} pending`}
            image={KPI_IMAGES.alerts}
            onClick={() => router.push(overview.activeDisputes > 0 ? '/dashboard/disputes' : '/dashboard/verifications')}
          />
        </div>
      ) : null}

      {/* ================================================================
         SECTION 1: Revenue Analytics
         ================================================================ */}
      <div className="mb-10">
        <SectionHeader
          title="Revenue Analytics"
          subtitle={`Revenue performance over the last ${period}`}
        />
        {chartsLoading ? (
          <SkeletonChart className="h-[380px]" />
        ) : (
          <>
            <LineTrend
              title="Revenue Trend"
              subtitle={`Platform revenue over the last ${period}`}
              data={revenueTrendChart}
              color={BRAND.gold}
              name="Revenue (KES)"
              height={320}
            />
            {revenueData && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div className="bg-card rounded-xl border border-border p-5">
                  <p className="text-sm text-muted-foreground">Period Revenue</p>
                  <p className="text-2xl font-bold mt-1 text-card-foreground">{fmtKES(revenueData.total)}</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-5">
                  <p className="text-sm text-muted-foreground">Growth</p>
                  <p className={`text-2xl font-bold mt-1 ${revenueData.growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {revenueData.growth >= 0 ? '+' : ''}{revenueData.growth.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-card rounded-xl border border-border p-5">
                  <p className="text-sm text-muted-foreground">Avg Daily</p>
                  <p className="text-2xl font-bold mt-1 text-card-foreground">
                    {fmtKES(revenueTrendChart.length > 0 ? revenueData.total / revenueTrendChart.length : 0)}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ================================================================
         SECTION 2: Bookings Analytics
         ================================================================ */}
      <div className="mb-10">
        <SectionHeader
          title="Bookings Analytics"
          subtitle="Booking status distribution and volume trends"
        />
        {chartsLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DonutBreakdown
              title="Bookings by Status"
              subtitle="Proportional breakdown of all booking statuses"
              data={bookingStatusDonut.length > 0 ? bookingStatusDonut : [{ name: 'No data', value: 1 }]}
              colors={bookingStatusDonut.map((s) => STATUS_COLORS[s.name] || BRAND.navy)}
              height={300}
            />
            <LineTrend
              title="Bookings Trend"
              subtitle={`Daily booking volume over ${period}`}
              data={bookingsTrendChart}
              color={BRAND.navy}
              name="Bookings"
              height={300}
            />
          </div>
        )}
      </div>

      {/* ================================================================
         SECTION 3: Users Analytics
         ================================================================ */}
      <div className="mb-10">
        <SectionHeader
          title="User Analytics"
          subtitle="New signups over time and role distribution"
        />
        {chartsLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LineSeries
              title="New Users Over Time"
              subtitle="Client vs Trainer signups"
              data={userSignupSeries}
              series={[
                { key: 'clients', name: 'Clients', color: BRAND.navy },
                { key: 'trainers', name: 'Trainers', color: BRAND.teal },
              ]}
              height={300}
            />
            <DonutBreakdown
              title="User Role Distribution"
              subtitle="Platform users by role"
              data={userRoleDonut.length > 0 ? userRoleDonut : [{ name: 'No data', value: 1 }]}
              colors={[BRAND.navy, BRAND.teal, BRAND.gold, BRAND.purple]}
              height={300}
            />
          </div>
        )}
      </div>

      {/* ================================================================
         SECTION 4: Top Trainers
         ================================================================ */}
      <div className="mb-10">
        <SectionHeader
          title="Top Trainers"
          subtitle="Highest performing trainers by revenue and rating"
        />
        {chartsLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonTable />
          </div>
        ) : (
          <>
            {/* Revenue Bar Chart */}
            {trainerRevenueBar.length > 0 && (
              <div className="mb-6">
                <BarCompare
                  title="Top 10 by Revenue"
                  subtitle="Trainer earnings ranked"
                  data={trainerRevenueBar}
                  color={BRAND.teal}
                  name="Revenue (KES)"
                  height={280}
                />
              </div>
            )}

            {/* Detailed Table */}
            {topTrainers.length > 0 && (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="font-semibold text-card-foreground">Top Trainers Leaderboard</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Click a row to view trainer details</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground w-12">#</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Trainer</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Email</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Revenue</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Bookings</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">Completed</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {topTrainers.map((t, i) => (
                        <tr
                          key={t.id}
                          className="hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => router.push(`/dashboard/trainers/${t.id}`)}
                        >
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              i === 0
                                ? 'bg-[#F77B0F]/20 text-[#F77B0F]'
                                : i === 1
                                ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                : i === 2
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#F77B0F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {t.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <span className="font-medium text-card-foreground">{t.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{t.email}</td>
                          <td className="px-4 py-3 text-right font-semibold text-[#0D9488]">
                            {fmtKES(t.totalRevenue)}
                          </td>
                          <td className="px-4 py-3 text-right text-card-foreground">{t.totalBookings}</td>
                          <td className="px-4 py-3 text-right text-card-foreground hidden sm:table-cell">{t.completedSessions}</td>
                          <td className="px-4 py-3 text-right">{renderStars(t.averageRating)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {topTrainers.length === 0 && trainerRevenueBar.length === 0 && (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <p className="text-muted-foreground text-sm">No trainer data available yet</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ================================================================
         SECTION 5: Categories
         ================================================================ */}
      <div className="mb-10">
        <SectionHeader
          title="Categories"
          subtitle="Which specializations and categories get the most traction"
        />
        {chartsLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonTable />
          </div>
        ) : categories.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarCompare
              title="Bookings by Category"
              subtitle="Number of bookings per specialization"
              data={categoryBookingsBar}
              color={BRAND.purple}
              name="Bookings"
              height={300}
            />
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="font-semibold text-card-foreground">Revenue by Category</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Earnings and trainer count per category</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Bookings</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Revenue</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Trainers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {categories.map((c, i) => (
                      <tr key={i} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: [BRAND.purple, BRAND.teal, BRAND.gold, BRAND.navy, BRAND.sky, BRAND.green, BRAND.pink, BRAND.red][i % 8] }} />
                            <span className="font-medium text-card-foreground">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-card-foreground">{c.bookings}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#0D9488]">{fmtKES(c.revenue)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{c.trainers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-muted-foreground text-sm">No category data available yet</p>
          </div>
        )}
      </div>

      {/* ================================================================
         SECTION 6: Recruitment Analytics (Uteo-specific)
         ================================================================ */}
      <div className="mb-10">
        <SectionHeader
          title="Recruitment Funnel"
          subtitle="Applications progressing through hiring stages"
        />
        {recruitmentLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funnel bar */}
            <BarCompare
              title="Hiring Funnel"
              subtitle="Applications submitted → Reviewed → Shortlisted → Hired"
              data={recruitmentFunnel.map(f => ({ date: f.name, value: f.value }))}
              color={BRAND.navy}
              name="Count"
              height={280}
            />
            {/* Applications per day */}
            <BarTrend
              title="Applications Per Day"
              subtitle="Daily application submissions (last 30 days)"
              data={appsPerDay}
              color={BRAND.gold}
              name="Applications"
              height={280}
            />
          </div>
        )}
      </div>

      <div className="mb-10">
        <SectionHeader
          title="Job Market Breakdown"
          subtitle="Top skills in demand and job type distribution"
        />
        {recruitmentLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top skills */}
            <BarCompare
              title="Top Skills in Demand"
              subtitle="Most requested skills across active job postings"
              data={topSkills.length > 0 ? topSkills : [{ date: 'No data', value: 0 }]}
              color={BRAND.teal}
              name="Jobs"
              height={300}
            />
            {/* Job type donut */}
            <DonutBreakdown
              title="Job Type Distribution"
              subtitle="Full-time / Part-time / Remote / Contract breakdown"
              data={jobTypeBreakdown.length > 0 ? jobTypeBreakdown : [{ name: 'No data', value: 1 }]}
              colors={[BRAND.navy, BRAND.gold, BRAND.teal, BRAND.purple, BRAND.sky, BRAND.green]}
              height={300}
            />
          </div>
        )}
      </div>

      {/* ================================================================
         SECTION 8: Platform Health
         ================================================================ */}
      <div className="mb-6">
        <SectionHeader
          title="Platform Health"
          subtitle="Disputes, verifications, and system status at a glance"
        />
        {overviewLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 h-28 animate-pulse">
                <div className="h-3 w-24 bg-muted rounded mb-3" />
                <div className="h-8 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Disputes */}
            <div
              className={`rounded-xl border p-5 cursor-pointer transition-all hover:shadow-md ${
                (overview?.activeDisputes || 0) > 0
                  ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                  : 'bg-card border-border'
              }`}
              onClick={() => router.push('/dashboard/disputes')}
            >
              <div className="flex items-center gap-2 mb-2">
                <svg className={`w-5 h-5 ${(overview?.activeDisputes || 0) > 0 ? 'text-red-500' : 'text-muted-foreground'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm font-medium text-muted-foreground">Active Disputes</p>
              </div>
              <p className={`text-3xl font-bold ${(overview?.activeDisputes || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-card-foreground'}`}>
                {overview?.activeDisputes || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">View all disputes &rarr;</p>
            </div>

            {/* Pending Verifications */}
            <div
              className={`rounded-xl border p-5 cursor-pointer transition-all hover:shadow-md ${
                (overview?.pendingVerifications || 0) > 0
                  ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                  : 'bg-card border-border'
              }`}
              onClick={() => router.push('/dashboard/verifications')}
            >
              <div className="flex items-center gap-2 mb-2">
                <svg className={`w-5 h-5 ${(overview?.pendingVerifications || 0) > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className="text-sm font-medium text-muted-foreground">Pending Verifications</p>
              </div>
              <p className={`text-3xl font-bold ${(overview?.pendingVerifications || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-card-foreground'}`}>
                {overview?.pendingVerifications || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Review verifications &rarr;</p>
            </div>

            {/* Escrow in Transit */}
            <div
              className="bg-card rounded-xl border border-border p-5 cursor-pointer transition-all hover:shadow-md"
              onClick={() => router.push('/dashboard/financials')}
            >
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[#6366F1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-sm font-medium text-muted-foreground">Escrow in Transit</p>
              </div>
              <p className="text-3xl font-bold text-card-foreground">--</p>
              <p className="text-xs text-muted-foreground mt-1">View financials &rarr;</p>
            </div>

            {/* Platform Wallet */}
            <div
              className="bg-card rounded-xl border border-border p-5 cursor-pointer transition-all hover:shadow-md"
              onClick={() => router.push('/dashboard/financials')}
            >
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[#0D9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <p className="text-sm font-medium text-muted-foreground">Platform Wallet</p>
              </div>
              <p className="text-3xl font-bold text-[#0D9488]">{fmtKES(overview?.totalRevenue || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">View wallet &rarr;</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
