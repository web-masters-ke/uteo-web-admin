'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { LineTrend, ColorBar, PieBreakdown, HorizBar, LineSeries, BarTrend } from '@/components/Charts';
import { analyticsService } from '@/lib/services/analyticsService';
import { applicationAdminService } from '@/lib/services/applicationAdminService';
import { jobService } from '@/lib/services/jobService';
import { userService } from '@/lib/services/userService';
import { useToast } from '@/lib/toast';
import { formatNumber } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d' | '1y';

interface OverviewKpis {
  totalJobSeekers: number;
  totalRecruiters: number;
  totalCompanies: number;
  openJobs: number;
  totalApplications: number;
  hiredCount: number;
  conversionRate: number;
  activeDisputes: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS: { label: string; value: Period; days: number }[] = [
  { label: '7 Days', value: '7d', days: 7 },
  { label: '30 Days', value: '30d', days: 30 },
  { label: '90 Days', value: '90d', days: 90 },
  { label: '1 Year', value: '1y', days: 365 },
];

const CHART_COLORS = ['#F77B0F', '#10B981', '#8B5CF6', '#06B6D4', '#F43F5E', '#F59E0B', '#34D399', '#FB923C'];
const FUNNEL_COLORS = ['#F59E0B', '#06B6D4', '#8B5CF6', '#F77B0F', '#6366F1', '#10B981', '#EF4444'];
const STATUS_ORDER = ['PENDING', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED'];

const KPI_PHOTOS = {
  seekers: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
  recruiters: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80',
  jobs: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
  applications: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80',
  hired: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80',
  conversion: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodDays(p: Period): number {
  return PERIODS.find(x => x.value === p)?.days ?? 30;
}

function buildDayMap(days: number): Record<string, number> {
  const map: Record<string, number> = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    map[d.toISOString().slice(5, 10)] = 0;
  }
  return map;
}

function isWithinDays(dateStr: string | undefined | null, days: number): boolean {
  if (!dateStr) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(dateStr) >= cutoff;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroKpiCard({ label, value, subtitle, photo, badge, onClick }: {
  label: string; value: string; subtitle?: string; photo: string;
  badge?: { value: number; label?: string }; onClick?: () => void;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg min-h-[150px] ${onClick ? 'cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all' : ''}`}
      onClick={onClick}
    >
      <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/65" />
      <div className="relative z-10">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">{label}</p>
        <p className="text-3xl font-black mt-2 tracking-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{value}</p>
        {badge && (
          <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${badge.value >= 0 ? 'bg-green-500/30 text-green-100' : 'bg-red-500/30 text-red-100'}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={badge.value >= 0 ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
            </svg>
            {badge.value >= 0 ? '+' : ''}{badge.value.toFixed(1)}% {badge.label ?? 'growth'}
          </span>
        )}
        {subtitle && !badge && <p className="text-sm font-semibold text-white/75 mt-2">{subtitle}</p>}
      </div>
    </div>
  );
}

function SectionDivider({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

function SkeletonKpiRow() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="rounded-2xl h-[150px] animate-pulse bg-muted/60" />)}
    </div>
  );
}

function SkeletonChart({ height = 300, className = '' }: { height?: number; className?: string }) {
  return (
    <div className={`bg-card rounded-xl border border-border p-6 animate-pulse ${className}`}>
      <div className="h-4 bg-muted rounded w-40 mb-2" />
      <div className="h-3 bg-muted rounded w-60 mb-4" />
      <div className="bg-muted/40 rounded-lg" style={{ height }} />
    </div>
  );
}

function StatTile({ label, value, sub, color = '#F77B0F', href, onClick }: {
  label: string; value: string | number; sub?: string; color?: string; href?: string; onClick?: () => void;
}) {
  const inner = (
    <div className="bg-card border border-border rounded-xl p-5 h-full hover:border-[#F77B0F]/30 transition-colors">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: color + '18' }}>
        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
  if (href) return <a href={href} className="block">{inner}</a>;
  if (onClick) return <button className="w-full text-left" onClick={onClick}>{inner}</button>;
  return inner;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);

  // KPI state
  const [kpis, setKpis] = useState<OverviewKpis | null>(null);

  // Chart data states
  const [appsPerDay, setAppsPerDay] = useState<{ date: string; value: number }[]>([]);
  const [signupsPerDay, setSignupsPerDay] = useState<{ date: string; value: number }[]>([]);
  const [appStatusPie, setAppStatusPie] = useState<{ name: string; value: number }[]>([]);
  const [jobTypePie, setJobTypePie] = useState<{ name: string; value: number }[]>([]);
  const [jobTypeBar, setJobTypeBar] = useState<{ name: string; value: number }[]>([]);
  const [funnelBar, setFunnelBar] = useState<{ name: string; value: number }[]>([]);
  const [topCompaniesBar, setTopCompaniesBar] = useState<{ name: string; value: number }[]>([]);
  const [userGrowthSeries, setUserGrowthSeries] = useState<{ date: string; seekers: number; recruiters: number }[]>([]);
  const [topSkillsBar, setTopSkillsBar] = useState<{ name: string; value: number }[]>([]);
  const [appsByLocation, setAppsByLocation] = useState<{ name: string; value: number }[]>([]);

  const days = periodDays(period);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashData, appsData, jobsData, usersData, analyticsData] = await Promise.all([
        analyticsService.getDashboard().catch(() => null),
        applicationAdminService.list({ limit: 500, page: 1 }).catch(() => ({ items: [], total: 0 })),
        jobService.list({ limit: 500, page: 1 }).catch(() => ({ items: [], total: 0 })),
        userService.getAll({ page: 1, limit: 500 }).catch(() => ({ items: [], total: 0 })),
        analyticsService.getAnalytics(undefined, undefined, days).catch(() => null),
      ]);

      const apps = ((appsData as any).items ?? []) as any[];
      const jobs = ((jobsData as any).items ?? []) as any[];
      const users = ((usersData as any).items ?? []) as any[];

      // ── KPIs ──────────────────────────────────────────────────────────────
      const hiredCount = apps.filter((a: any) => a.status === 'HIRED').length;
      const openJobs = jobs.filter((j: any) => j.status === 'ACTIVE').length;
      const totalApplications = (appsData as any).total ?? apps.length;

      setKpis({
        totalJobSeekers: dashData?.totalUsers ?? (usersData as any).total ?? 0,
        totalRecruiters: dashData?.totalTrainers ?? users.filter((u: any) => u.role === 'RECRUITER' || u.role === 'TRAINER').length,
        totalCompanies: dashData?.totalCompanies ?? 0,
        openJobs,
        totalApplications,
        hiredCount,
        conversionRate: totalApplications > 0 ? parseFloat(((hiredCount / totalApplications) * 100).toFixed(1)) : 0,
        activeDisputes: dashData?.activeDisputes ?? 0,
      });

      // ── Applications per day ───────────────────────────────────────────
      const dayMap = buildDayMap(days);
      apps.forEach((a: any) => {
        const key = (a.appliedAt || a.createdAt || '').slice(5, 10);
        if (key in dayMap) dayMap[key]++;
      });
      setAppsPerDay(Object.entries(dayMap).map(([date, value]) => ({ date, value })));

      // ── Sign-ups per day ───────────────────────────────────────────────
      if (analyticsData?.signupsPerDay?.length) {
        setSignupsPerDay(analyticsData.signupsPerDay.map((d: any) => ({ date: d.date.slice(5), value: d.count })));
      }

      // ── App status solid pie ───────────────────────────────────────────
      const statusMap: Record<string, number> = {};
      apps.forEach((a: any) => { statusMap[a.status] = (statusMap[a.status] || 0) + 1; });
      setAppStatusPie(
        STATUS_ORDER
          .filter(s => statusMap[s] > 0)
          .map(s => ({ name: s.replace(/_/g, ' '), value: statusMap[s] }))
      );

      // ── Hiring funnel (horizontal bar) ────────────────────────────────
      setFunnelBar(
        STATUS_ORDER
          .filter(s => statusMap[s] > 0)
          .map(s => ({ name: s.replace(/_/g, ' '), value: statusMap[s] }))
      );

      // ── Jobs by type (colored bars + solid pie) ────────────────────────
      const typeMap: Record<string, number> = {};
      jobs.forEach((j: any) => {
        const t = (j.jobType || 'OTHER').replace(/_/g, ' ');
        typeMap[t] = (typeMap[t] || 0) + 1;
      });
      const typeEntries = Object.entries(typeMap).map(([name, value]) => ({ name, value }));
      setJobTypeBar(typeEntries);
      setJobTypePie(typeEntries);

      // ── Top companies by open jobs ─────────────────────────────────────
      const compMap: Record<string, number> = {};
      jobs.forEach((j: any) => {
        const name = j.company?.name || 'Unknown';
        compMap[name] = (compMap[name] || 0) + 1;
      });
      setTopCompaniesBar(
        Object.entries(compMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .map(([name, value]) => ({
            name: name.length > 16 ? name.slice(0, 16) + '…' : name,
            value,
          }))
      );

      // ── User growth (candidates vs recruiters per day) ─────────────────
      const seekerDayMap = buildDayMap(days);
      const recruiterDayMap = buildDayMap(days);
      users.forEach((u: any) => {
        const key = (u.createdAt || '').slice(5, 10);
        if (u.role === 'RECRUITER' || u.role === 'TRAINER') {
          if (key in recruiterDayMap) recruiterDayMap[key]++;
        } else {
          if (key in seekerDayMap) seekerDayMap[key]++;
        }
      });
      setUserGrowthSeries(
        Object.keys(seekerDayMap).map(date => ({
          date,
          seekers: seekerDayMap[date],
          recruiters: recruiterDayMap[date] || 0,
        }))
      );

      // ── Top skills in demand ───────────────────────────────────────────
      const skillMap: Record<string, number> = {};
      jobs.forEach((j: any) => {
        (j.skillNames || j.skills || []).forEach((s: string) => {
          skillMap[s] = (skillMap[s] || 0) + 1;
        });
      });
      setTopSkillsBar(
        Object.entries(skillMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([name, value]) => ({ name: name.length > 16 ? name.slice(0, 16) + '…' : name, value }))
      );

      // ── Applications by location ───────────────────────────────────────
      const locMap: Record<string, number> = {};
      jobs.forEach((j: any) => {
        if (j.location) {
          const loc = j.location.split(',')[0].trim();
          locMap[loc] = (locMap[loc] || 0) + 1;
        }
      });
      setAppsByLocation(
        Object.entries(locMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .map(([name, value]) => ({ name: name.length > 16 ? name.slice(0, 16) + '…' : name, value }))
      );

    } catch {
      addToast('error', 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [period, days, addToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics' }]}
      />
      <p className="text-muted-foreground -mt-4 mb-6 text-sm">
        Recruitment performance, pipeline health, and platform growth
      </p>

      {/* ── Period Selector ──────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit mb-8">
        {PERIODS.map(p => (
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

      {/* ── Hero KPI Cards ───────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonKpiRow />
      ) : kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
          <HeroKpiCard
            label="Job Seekers"
            value={formatNumber(kpis.totalJobSeekers)}
            subtitle="Registered candidates"
            photo={KPI_PHOTOS.seekers}
            onClick={() => router.push('/dashboard/users')}
          />
          <HeroKpiCard
            label="Recruiters"
            value={formatNumber(kpis.totalRecruiters)}
            subtitle="Active hiring teams"
            photo={KPI_PHOTOS.recruiters}
            onClick={() => router.push('/dashboard/trainers')}
          />
          <HeroKpiCard
            label="Open Jobs"
            value={formatNumber(kpis.openJobs)}
            subtitle={`of ${formatNumber(kpis.openJobs)} total postings`}
            photo={KPI_PHOTOS.jobs}
            onClick={() => router.push('/dashboard/jobs')}
          />
          <HeroKpiCard
            label="Applications"
            value={formatNumber(kpis.totalApplications)}
            subtitle="All time submissions"
            photo={KPI_PHOTOS.applications}
            onClick={() => router.push('/dashboard/applications')}
          />
          <HeroKpiCard
            label="Hired"
            value={formatNumber(kpis.hiredCount)}
            subtitle="Successful placements"
            photo={KPI_PHOTOS.hired}
          />
          <HeroKpiCard
            label="Conversion Rate"
            value={`${kpis.conversionRate}%`}
            subtitle="Applications → hired"
            photo={KPI_PHOTOS.conversion}
          />
        </div>
      )}

      {/* ================================================================
          SECTION 1 — Application Pipeline
         ================================================================ */}
      <div className="mb-10">
        <SectionDivider
          title="Application Pipeline"
          subtitle={`Applications and hiring funnel over the last ${period}`}
        />
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SkeletonChart height={280} className="lg:col-span-2" />
            <SkeletonChart height={280} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <LineTrend
              title="Applications Per Day"
              subtitle={`Daily submission volume — last ${period}`}
              data={appsPerDay}
              color="#F77B0F"
              name="Applications"
              height={280}
              className="lg:col-span-2"
            />
            <PieBreakdown
              title="By Status"
              subtitle="Current pipeline stage breakdown"
              data={appStatusPie.length ? appStatusPie : [{ name: 'No data', value: 1 }]}
              colors={FUNNEL_COLORS}
              height={280}
            />
          </div>
        )}
      </div>

      {/* ================================================================
          SECTION 2 — Hiring Funnel
         ================================================================ */}
      <div className="mb-10">
        <SectionDivider
          title="Hiring Funnel"
          subtitle="How applications progress from submission to hire"
        />
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart height={260} />
            <SkeletonChart height={260} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HorizBar
              title="Funnel Stage Counts"
              subtitle="Volume at each stage of the hiring pipeline"
              data={funnelBar.length ? funnelBar : STATUS_ORDER.slice(0, 5).map(s => ({ name: s.replace(/_/g, ' '), value: 0 }))}
              colors={FUNNEL_COLORS}
              height={260}
            />
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-card-foreground mb-1">Stage Conversion Rates</h3>
              <p className="text-xs text-muted-foreground mb-5">Drop-off between consecutive pipeline stages</p>
              {funnelBar.length > 1 ? (
                <div className="space-y-3">
                  {funnelBar.slice(0, -1).map((stage, i) => {
                    const next = funnelBar[i + 1];
                    const rate = stage.value > 0 ? ((next.value / stage.value) * 100).toFixed(0) : '0';
                    const pct = stage.value > 0 ? (next.value / stage.value) : 0;
                    return (
                      <div key={stage.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{stage.name} → {next.name}</span>
                          <span className="font-semibold text-foreground">{rate}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct * 100, 100)}%`, background: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">No funnel data yet</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================
          SECTION 3 — Jobs Market Intelligence
         ================================================================ */}
      <div className="mb-10">
        <SectionDivider
          title="Jobs Market Intelligence"
          subtitle="Employment type distribution and top hiring companies"
        />
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart height={260} />
            <SkeletonChart height={260} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ColorBar
              title="Jobs by Employment Type"
              subtitle="Distribution across full-time, part-time, contract, remote"
              data={jobTypeBar.length ? jobTypeBar : [{ name: 'Full Time', value: 0 }]}
              colors={CHART_COLORS}
              height={260}
            />
            <HorizBar
              title="Top Hiring Companies"
              subtitle="Companies with the most active job postings"
              data={topCompaniesBar.length ? topCompaniesBar : [{ name: 'No data', value: 0 }]}
              colors={CHART_COLORS}
              height={260}
            />
          </div>
        )}
      </div>

      {/* ================================================================
          SECTION 4 — Skills & Locations
         ================================================================ */}
      <div className="mb-10">
        <SectionDivider
          title="Skills & Location Demand"
          subtitle="Most sought-after skills and top job locations"
        />
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart height={280} />
            <SkeletonChart height={280} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HorizBar
              title="Top Skills in Demand"
              subtitle="Most requested skills across active job postings"
              data={topSkillsBar.length ? topSkillsBar : [{ name: 'No skills data', value: 0 }]}
              colors={CHART_COLORS}
              height={280}
            />
            <HorizBar
              title="Jobs by Location"
              subtitle="Cities and regions with the most open positions"
              data={appsByLocation.length ? appsByLocation : [{ name: 'No location data', value: 0 }]}
              colors={[...CHART_COLORS].reverse()}
              height={280}
            />
          </div>
        )}
      </div>

      {/* ================================================================
          SECTION 5 — Platform Growth
         ================================================================ */}
      <div className="mb-10">
        <SectionDivider
          title="Platform Growth"
          subtitle="User registrations and role distribution over time"
        />
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SkeletonChart height={280} className="lg:col-span-2" />
            <SkeletonChart height={280} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <LineSeries
              title="User Growth Over Time"
              subtitle="Job seekers vs recruiters signing up per day"
              data={userGrowthSeries}
              series={[
                { key: 'seekers', name: 'Job Seekers', color: '#F77B0F' },
                { key: 'recruiters', name: 'Recruiters', color: '#10B981' },
              ]}
              height={280}
              className="lg:col-span-2"
            />
            <PieBreakdown
              title="Job Type Mix"
              subtitle="Employment type breakdown"
              data={jobTypePie.length ? jobTypePie : [{ name: 'No data', value: 1 }]}
              colors={CHART_COLORS}
              height={280}
            />
          </div>
        )}
      </div>

      {/* ================================================================
          SECTION 6 — Platform Health Tiles
         ================================================================ */}
      <div className="mb-6">
        <SectionDivider
          title="Platform Health"
          subtitle="Disputes, open positions, and key operational metrics"
        />
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 h-28 animate-pulse">
                <div className="h-3 w-24 bg-muted rounded mb-3" />
                <div className="h-8 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatTile
              label="Open Jobs"
              value={formatNumber(kpis?.openJobs ?? 0)}
              sub="Active listings right now"
              color="#10B981"
              onClick={() => router.push('/dashboard/jobs')}
            />
            <StatTile
              label="Pending Review"
              value={formatNumber(appStatusPie.find(s => s.name === 'PENDING')?.value ?? 0)}
              sub="Applications awaiting action"
              color="#F77B0F"
              onClick={() => router.push('/dashboard/applications')}
            />
            <StatTile
              label="Active Disputes"
              value={formatNumber(kpis?.activeDisputes ?? 0)}
              sub={kpis?.activeDisputes ? 'Needs attention' : 'All clear'}
              color={kpis?.activeDisputes ? '#EF4444' : '#10B981'}
              onClick={() => router.push('/dashboard/disputes')}
            />
            <StatTile
              label="Conversion Rate"
              value={`${kpis?.conversionRate ?? 0}%`}
              sub="Applications → hired"
              color="#8B5CF6"
            />
          </div>
        )}
      </div>

    </div>
  );
}
