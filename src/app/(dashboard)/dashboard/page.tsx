'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarTrend, DonutBreakdown } from '@/components/Charts';
import { StatusBadge } from '@/components/StatusBadge';
import { analyticsService } from '@/lib/services/analyticsService';
import { jobService, AdminJob } from '@/lib/services/jobService';
import { applicationAdminService, AdminApplication } from '@/lib/services/applicationAdminService';
import { userService } from '@/lib/services/userService';
import { User } from '@/lib/types';
import { formatNumber, formatDate, getInitials } from '@/lib/utils';
import { useToast } from '@/lib/toast';

const BRAND = '#192C67';
const ORANGE = '#F77B0F';

function MetricCard({
  label, value, sub, dot, href,
}: {
  label: string; value: string | number; sub?: string; dot?: string; href?: string;
}) {
  const content = (
    <div className="bg-card border border-border rounded-xl p-5 relative overflow-hidden group-hover:border-[#192C67]/30 transition-colors h-full">
      <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background: dot || BRAND }} />
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 pr-4">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-foreground leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
  if (href) return <Link href={href} className="group block">{content}</Link>;
  return <div>{content}</div>;
}

function SectionHeader({ title, sub, href }: { title: string; sub?: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="text-xs font-semibold text-[#192C67] dark:text-blue-400 hover:underline flex items-center gap-1">
          View all
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </Link>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 h-24 animate-pulse">
      <div className="h-3 w-20 bg-muted rounded mb-3" />
      <div className="h-7 w-24 bg-muted rounded" />
    </div>
  );
}

const STATUS_BADGE_MAP: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  UNDER_REVIEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  REVIEWED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  SHORTLISTED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  HIRED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  WITHDRAWN: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CLOSED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  DRAFT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE_MAP[status] || 'bg-muted text-muted-foreground'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

const QUICK_LINKS = [
  { label: 'Users', href: '/dashboard/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197' },
  { label: 'Companies', href: '/dashboard/companies', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { label: 'Jobs', href: '/dashboard/jobs', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { label: 'Applications', href: '/dashboard/applications', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: 'Reports', href: '/dashboard/reports', icon: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { label: 'Notifications', href: '/dashboard/notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { label: 'Audit Logs', href: '/dashboard/audit-logs', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
];

interface DashboardStats {
  totalUsers: number;
  totalJobs: number;
  totalApplications: number;
  totalCompanies: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<AdminJob[]>([]);
  const [recentApplications, setRecentApplications] = useState<AdminApplication[]>([]);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [signupChart, setSignupChart] = useState<{ date: string; value: number }[]>([]);
  const [appStatusDonut, setAppStatusDonut] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addToast } = useToast();

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [dashData, jobsData, appsData, usersData, analyticsData] = await Promise.all([
        analyticsService.getDashboard().catch(() => null),
        jobService.list({ limit: 10, page: 1 }).catch(() => ({ items: [], total: 0 })),
        applicationAdminService.list({ limit: 10, page: 1 }).catch(() => ({ items: [], total: 0 })),
        userService.getAll({ page: 1, limit: 10 }).catch(() => ({ items: [], total: 0, totalPages: 1 })),
        analyticsService.getAnalytics(undefined, undefined, 30).catch(() => null),
      ]);

      const jobsResult = jobsData as { items: AdminJob[]; total: number };
      const appsResult = appsData as { items: AdminApplication[]; total: number };
      const usersResult = usersData as { items: User[]; total: number };

      setStats({
        totalUsers: dashData?.totalUsers ?? usersResult.total ?? 0,
        totalJobs: jobsResult.total ?? 0,
        totalApplications: appsResult.total ?? 0,
        totalCompanies: 0,
      });

      setRecentJobs(jobsResult.items ?? []);
      setRecentApplications(appsResult.items ?? []);
      setRecentUsers(usersResult.items ?? []);

      if (analyticsData?.signupsPerDay?.length) {
        setSignupChart(analyticsData.signupsPerDay.map(d => ({ date: d.date.slice(5), value: d.count })));
      }

      const statusCounts: Record<string, number> = {};
      (appsResult.items ?? []).forEach((a: AdminApplication) => {
        statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
      });
      setAppStatusDonut(Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })));
    } catch {
      addToast('error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-7 pb-8">

      {/* Top bar */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Recruitment Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#192C67] text-white text-sm font-semibold rounded-lg hover:bg-[#14234f] transition-colors disabled:opacity-60"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {refreshing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : stats ? (
          <>
            <MetricCard label="Total Users" value={formatNumber(stats.totalUsers)} sub="Job seekers & recruiters" dot={BRAND} href="/dashboard/users" />
            <MetricCard label="Total Jobs" value={formatNumber(stats.totalJobs)} sub="Active postings" dot={ORANGE} href="/dashboard/jobs" />
            <MetricCard label="Applications" value={formatNumber(stats.totalApplications)} sub="All submissions" dot="#10b981" href="/dashboard/applications" />
            <MetricCard label="Companies" value={formatNumber(stats.totalCompanies)} sub="Registered employers" dot="#8b5cf6" href="/dashboard/companies" />
          </>
        ) : null}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarTrend
          title="User Sign-ups"
          subtitle="New registrations over the last 30 days"
          data={signupChart.length > 0 ? signupChart : []}
          color={BRAND}
          name="Sign-ups"
          height={280}
        />
        <DonutBreakdown
          title="Applications by Status"
          subtitle="Breakdown of current application statuses"
          data={appStatusDonut.length > 0 ? appStatusDonut : [{ name: 'No data', value: 1 }]}
          colors={['#F77B0F', '#192C67', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4']}
          height={280}
        />
      </div>

      {/* Recent activity tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Job Postings */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <SectionHeader title="Recent Jobs" sub="Last 10 job postings" href="/dashboard/jobs" />
          </div>
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3 animate-pulse flex gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-48" />
                    <div className="h-2 bg-muted rounded w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-sm text-muted-foreground">No jobs posted yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentJobs.map(job => (
                <Link key={job.id} href={`/dashboard/jobs/${job.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#192C67]/10 text-[#192C67] flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {job.company?.name?.[0]?.toUpperCase() || 'J'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{job.company?.name} &middot; {job.jobType?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="text-xs text-muted-foreground hidden sm:block">{job._count?.applications ?? 0} apps</span>
                    <StatusPill status={job.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Applications */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <SectionHeader title="Recent Applications" sub="Last 10 submissions" href="/dashboard/applications" />
          </div>
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3 animate-pulse flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-40" />
                    <div className="h-2 bg-muted rounded w-28" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentApplications.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-muted-foreground">No applications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentApplications.map(app => (
                <div key={app.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-[#F77B0F]/10 text-[#F77B0F] flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {getInitials(app.user?.firstName, app.user?.lastName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {app.user?.firstName || ''} {app.user?.lastName || app.user?.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{app.job?.title} &middot; {app.job?.company?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <StatusPill status={app.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Users */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <SectionHeader title="Recent Registrations" sub="Newest platform members" href="/dashboard/users" />
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 divide-x divide-y divide-border">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="px-4 py-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
                  <div className="space-y-1 flex-1">
                    <div className="h-3 bg-muted rounded w-24" />
                    <div className="h-2 bg-muted rounded w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : recentUsers.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No users yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentUsers.map(u => (
              <Link key={u.id} href={`/dashboard/users/${u.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-[#192C67]/10 text-[#192C67] flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {getInitials(u.firstName, u.lastName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className="text-xs text-muted-foreground hidden sm:block">{formatDate(u.createdAt)}</span>
                  <StatusBadge status={u.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Navigation */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Quick Navigation</p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {QUICK_LINKS.map(ql => (
            <Link
              key={ql.href}
              href={ql.href}
              className="flex flex-col items-center gap-2 p-3 bg-card border border-border rounded-xl hover:border-[#192C67]/40 hover:bg-[#192C67]/5 transition-all group text-center"
            >
              <div className="w-9 h-9 rounded-lg bg-[#192C67]/8 flex items-center justify-center group-hover:bg-[#192C67]/15 transition-colors">
                <svg className="w-5 h-5 text-[#192C67] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={ql.icon} />
                </svg>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors leading-tight">{ql.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
