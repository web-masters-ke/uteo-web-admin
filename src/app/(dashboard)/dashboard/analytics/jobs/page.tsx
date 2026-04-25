'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { BarTrend, BarCompare, LineTrend } from '@/components/Charts';
import { jobService, AdminJob } from '@/lib/services/jobService';
import { applicationAdminService } from '@/lib/services/applicationAdminService';
import { useToast } from '@/lib/toast';
import { formatNumber, formatDate } from '@/lib/utils';

type Period = '7d' | '30d' | '90d';

const PERIODS: { label: string; value: Period }[] = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
];

function SkeletonChart({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-card rounded-xl border border-border p-6 animate-pulse ${className}`}>
      <div className="h-5 bg-muted rounded w-40 mb-2" />
      <div className="h-3 bg-muted rounded w-56 mb-6" />
      <div className="h-[260px] bg-muted/40 rounded" />
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function JobAnalyticsPage() {
  const { addToast } = useToast();
  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);

  // Chart data
  const [jobsPerDay, setJobsPerDay] = useState<{ date: string; value: number }[]>([]);
  const [topTitles, setTopTitles] = useState<{ date: string; value: number }[]>([]);
  const [appsPerJob, setAppsPerJob] = useState<{ date: string; value: number }[]>([]);
  const [topCompanies, setTopCompanies] = useState<{ date: string; value: number }[]>([]);

  // KPIs
  const [totalJobs, setTotalJobs] = useState(0);
  const [avgAppsPerJob, setAvgAppsPerJob] = useState(0);
  const [avgTimeToFirstApp, setAvgTimeToFirstApp] = useState('--');
  const [activeJobs, setActiveJobs] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;

      const [jobsData, appsData] = await Promise.all([
        jobService.list({ limit: 500 }).catch(() => ({ items: [], total: 0 })),
        applicationAdminService.list({ limit: 500 }).catch(() => ({ items: [], total: 0 })),
      ]);

      const jobs = ((jobsData as any).items ?? []) as AdminJob[];
      const apps = ((appsData as any).items ?? []) as any[];

      setTotalJobs((jobsData as any).total ?? jobs.length);
      setActiveJobs(jobs.filter(j => j.status === 'ACTIVE').length);

      // Jobs per day (last N days)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const dayMap: Record<string, number> = {};
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dayMap[d.toISOString().slice(5, 10)] = 0;
      }
      jobs.forEach(j => {
        const key = (j.createdAt || '').slice(5, 10);
        if (key in dayMap) dayMap[key]++;
      });
      setJobsPerDay(Object.entries(dayMap).map(([date, value]) => ({ date, value })));

      // Top job titles
      const titleCounts: Record<string, number> = {};
      jobs.forEach(j => {
        const t = j.title || 'Untitled';
        titleCounts[t] = (titleCounts[t] || 0) + 1;
      });
      setTopTitles(
        Object.entries(titleCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([name, value]) => ({
            date: name.length > 20 ? name.slice(0, 20) + '..' : name,
            value,
          }))
      );

      // Applications per job
      const appCountByJob: Record<string, number> = {};
      apps.forEach((a: any) => {
        const jid = a.job?.id || a.jobId;
        if (jid) appCountByJob[jid] = (appCountByJob[jid] || 0) + 1;
      });
      const appCounts = Object.values(appCountByJob);
      if (appCounts.length > 0) {
        setAvgAppsPerJob(Math.round(appCounts.reduce((s, v) => s + v, 0) / appCounts.length));
      }

      // Histogram buckets: 0, 1-5, 6-10, 11-20, 21-50, 50+
      const buckets: Record<string, number> = { '0': 0, '1-5': 0, '6-10': 0, '11-20': 0, '21-50': 0, '50+': 0 };
      jobs.forEach(j => {
        const cnt = appCountByJob[j.id] || 0;
        if (cnt === 0) buckets['0']++;
        else if (cnt <= 5) buckets['1-5']++;
        else if (cnt <= 10) buckets['6-10']++;
        else if (cnt <= 20) buckets['11-20']++;
        else if (cnt <= 50) buckets['21-50']++;
        else buckets['50+']++;
      });
      setAppsPerJob(Object.entries(buckets).map(([date, value]) => ({ date, value })));

      // Top companies by job count
      const companyCounts: Record<string, number> = {};
      jobs.forEach(j => {
        const name = j.company?.name || 'Unknown';
        companyCounts[name] = (companyCounts[name] || 0) + 1;
      });
      setTopCompanies(
        Object.entries(companyCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([name, value]) => ({
            date: name.length > 16 ? name.slice(0, 16) + '..' : name,
            value,
          }))
      );

      // Avg time to first application (hours)
      let totalHours = 0;
      let jobsWithApps = 0;
      jobs.forEach(j => {
        const firstApp = apps
          .filter((a: any) => (a.job?.id || a.jobId) === j.id)
          .sort((a: any, b: any) => new Date(a.appliedAt || a.createdAt).getTime() - new Date(b.appliedAt || b.createdAt).getTime())[0];
        if (firstApp) {
          const jobTime = new Date(j.createdAt).getTime();
          const appTime = new Date(firstApp.appliedAt || firstApp.createdAt).getTime();
          const diff = (appTime - jobTime) / (1000 * 60 * 60);
          if (diff >= 0) { totalHours += diff; jobsWithApps++; }
        }
      });
      if (jobsWithApps > 0) {
        const avg = totalHours / jobsWithApps;
        if (avg < 24) setAvgTimeToFirstApp(`${Math.round(avg)}h`);
        else setAvgTimeToFirstApp(`${Math.round(avg / 24)}d`);
      }
    } catch {
      addToast('error', 'Failed to load job analytics');
    } finally {
      setLoading(false);
    }
  }, [period, addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <PageHeader
        title="Job Analytics"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Analytics', href: '/dashboard/analytics' },
          { label: 'Jobs' },
        ]}
      />
      <p className="text-muted-foreground -mt-4 mb-6 text-sm">Deep-dive into job posting trends, applicant volume, and employer performance</p>

      {/* Period Selector */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit mb-8">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              period === p.value ? 'bg-card text-card-foreground shadow-sm' : 'text-muted-foreground hover:text-card-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-5 h-24 animate-pulse">
              <div className="h-3 w-24 bg-muted rounded mb-3" /><div className="h-7 w-16 bg-muted rounded" />
            </div>
          ))
        ) : (
          <>
            <MetricCard label="Total Jobs" value={formatNumber(totalJobs)} sub="All time postings" />
            <MetricCard label="Active Jobs" value={formatNumber(activeJobs)} sub="Currently open" />
            <MetricCard label="Avg Applications" value={avgAppsPerJob} sub="Per job posting" />
            <MetricCard label="Avg Time to 1st App" value={avgTimeToFirstApp} sub="From posting to first apply" />
          </>
        )}
      </div>

      {/* Jobs per day */}
      <div className="mb-8">
        {loading ? <SkeletonChart /> : (
          <LineTrend
            title="Jobs Posted Over Time"
            subtitle={`New job postings per day (last ${period})`}
            data={jobsPerDay}
            color="#192C67"
            name="Jobs"
            height={280}
          />
        )}
      </div>

      {/* Top titles + Apps per job histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {loading ? (
          <>
            <SkeletonChart />
            <SkeletonChart />
          </>
        ) : (
          <>
            <BarCompare
              title="Most Popular Job Titles"
              subtitle="Job titles with the most postings"
              data={topTitles.length > 0 ? topTitles : [{ date: 'No data', value: 0 }]}
              color="#F77B0F"
              name="Postings"
              height={300}
            />
            <BarTrend
              title="Applications Per Job (Distribution)"
              subtitle="How many applications each job bucket receives"
              data={appsPerJob}
              color="#10b981"
              name="Jobs"
              height={300}
            />
          </>
        )}
      </div>

      {/* Top companies */}
      <div className="mb-8">
        {loading ? <SkeletonChart /> : (
          <BarCompare
            title="Top Companies by Job Count"
            subtitle="Employers with the most active postings"
            data={topCompanies.length > 0 ? topCompanies : [{ date: 'No data', value: 0 }]}
            color="#8b5cf6"
            name="Jobs"
            height={300}
          />
        )}
      </div>
    </div>
  );
}
