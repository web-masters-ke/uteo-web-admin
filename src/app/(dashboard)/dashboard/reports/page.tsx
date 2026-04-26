'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import api, { unwrap } from '@/lib/api';
import { useToast } from '@/lib/toast';

/* ── helpers ─────────────────────────────────────────────────────────── */

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function downloadCSV(rows: string[][], filename: string) {
  const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const LIMIT = 20;

const ic = 'px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F77B0F]/50 focus:border-[#F77B0F]';

const APP_STATUSES = ['SUBMITTED', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW', 'HIRED', 'REJECTED'];
const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE', 'HYBRID'];

const STATUS_COLOR: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  REVIEWED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  SHORTLISTED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  INTERVIEW: 'bg-[#F77B0F]/10 text-[#F77B0F]',
  HIRED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  CLOSED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  DRAFT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

/* ── tab: applications ─────────────────────────────────────────────── */

function ApplicationsTab() {
  const { addToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const load = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(pg), limit: String(LIMIT) });
      if (statusFilter) p.set('status', statusFilter);
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo) p.set('dateTo', dateTo);
      const d = await unwrap<{ items: any[]; total: number }>(await api.get(`/applications?${p}`));
      setItems(d.items ?? []);
      setTotal(d.total ?? 0);
    } catch { addToast('error', 'Failed to load applications'); }
    finally { setLoading(false); }
  }, [statusFilter, dateFrom, dateTo, addToast]);

  useEffect(() => { setPage(1); load(1); }, [statusFilter, dateFrom, dateTo]); // eslint-disable-line

  const handlePage = (p: number) => { setPage(p); load(p); };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const p = new URLSearchParams({ page: '1', limit: '100' });
      if (statusFilter) p.set('status', statusFilter);
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo) p.set('dateTo', dateTo);
      const d = await unwrap<{ items: any[] }>(await api.get(`/applications?${p}`));
      const rows = d.items ?? [];
      const header = ['Candidate Name', 'Email', 'Job Title', 'Company', 'Status', 'Applied Date', 'Scheduled At'];
      const data = rows.map(a => [
        `${a.user?.firstName ?? ''} ${a.user?.lastName ?? ''}`.trim(),
        a.user?.email ?? '',
        a.job?.title ?? '',
        a.job?.company?.name ?? '',
        a.status ?? '',
        fmtDate(a.appliedAt),
        fmtDate(a.scheduledAt),
      ]);
      downloadCSV([header, ...data], `applications-${new Date().toISOString().slice(0, 10)}.csv`);
      addToast('success', `Exported ${rows.length} applications`);
    } catch { addToast('error', 'Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4">
      {/* Filters + export */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={ic}>
            <option value="">All Statuses</option>
            {APP_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={ic} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={ic} />
        </div>
        {(statusFilter || dateFrom || dateTo) && (
          <button onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 pb-0.5">
            Clear
          </button>
        )}
        <div className="ml-auto">
          <button onClick={exportCSV} disabled={exporting || loading}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline disabled:opacity-40 transition-opacity">
            {exporting ? <span className="w-4 h-4 border-2 border-[#F77B0F] border-t-transparent rounded-full animate-spin" /> : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            )}
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-[#F77B0F] border-t-transparent rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-sm">No applications found</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-900 dark:text-white">{`${a.user?.firstName ?? ''} ${a.user?.lastName ?? ''}`.trim() || '—'}</p>
                      <p className="text-xs text-gray-400">{a.user?.email}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-900 dark:text-white">{a.job?.title}</p>
                      <p className="text-xs text-gray-400">{a.job?.company?.name}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {a.status?.charAt(0) + a.status?.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">{fmtDate(a.appliedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
              <span className="text-xs text-gray-500">{total} total · showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)}</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => handlePage(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">← Prev</button>
                <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">{page} / {totalPages}</span>
                <button onClick={() => handlePage(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── tab: jobs ─────────────────────────────────────────────────────── */

function JobsTab() {
  const { addToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [typeFilter, setTypeFilter] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const load = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(pg), limit: String(LIMIT) });
      if (statusFilter) p.set('status', statusFilter);
      if (typeFilter) p.set('jobType', typeFilter);
      const d = await unwrap<{ items: any[]; total: number }>(await api.get(`/jobs?${p}`));
      setItems(d.items ?? []);
      setTotal(d.total ?? 0);
    } catch { addToast('error', 'Failed to load jobs'); }
    finally { setLoading(false); }
  }, [statusFilter, typeFilter, addToast]);

  useEffect(() => { setPage(1); load(1); }, [statusFilter, typeFilter]); // eslint-disable-line

  const handlePage = (p: number) => { setPage(p); load(p); };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const p = new URLSearchParams({ page: '1', limit: '100' });
      if (statusFilter) p.set('status', statusFilter);
      if (typeFilter) p.set('jobType', typeFilter);
      const d = await unwrap<{ items: any[] }>(await api.get(`/jobs?${p}`));
      const rows = d.items ?? [];
      const header = ['Job Title', 'Company', 'Type', 'Location', 'Status', 'Salary Min', 'Salary Max', 'Applications', 'Posted Date', 'Expires'];
      const data = rows.map((j: any) => [
        j.title ?? '',
        j.company?.name ?? '',
        j.jobType ?? '',
        j.location ?? '',
        j.status ?? '',
        j.salaryMin ?? '',
        j.salaryMax ?? '',
        String(j._count?.applications ?? 0),
        fmtDate(j.createdAt),
        fmtDate(j.expiresAt),
      ]);
      downloadCSV([header, ...data], `jobs-${new Date().toISOString().slice(0, 10)}.csv`);
      addToast('success', `Exported ${rows.length} jobs`);
    } catch { addToast('error', 'Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={ic}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Type</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={ic}>
            <option value="">All Types</option>
            {JOB_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        {(typeFilter) && (
          <button onClick={() => setTypeFilter('')} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 pb-0.5">Clear</button>
        )}
        <div className="ml-auto">
          <button onClick={exportCSV} disabled={exporting || loading}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline disabled:opacity-40 transition-opacity">
            {exporting ? <span className="w-4 h-4 border-2 border-[#F77B0F] border-t-transparent rounded-full animate-spin" /> : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            )}
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-[#F77B0F] border-t-transparent rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <p className="text-sm">No jobs found</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Applicants</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Posted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map((j: any) => (
                  <tr key={j.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-900 dark:text-white">{j.title}</p>
                      <p className="text-xs text-gray-400">{j.company?.name}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">{j.jobType?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">{j.location ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{j._count?.applications ?? 0}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[j.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {j.status?.charAt(0) + j.status?.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">{fmtDate(j.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
              <span className="text-xs text-gray-500">{total} total · showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)}</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => handlePage(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">← Prev</button>
                <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">{page} / {totalPages}</span>
                <button onClick={() => handlePage(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── main page ─────────────────────────────────────────────────────── */

type Tab = 'applications' | 'jobs';

export default function ReportsPage() {
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>('applications');
  const [stats, setStats] = useState({ applications: 0, hired: 0, activeJobs: 0, candidates: 0 });

  useEffect(() => {
    Promise.allSettled([
      api.get('/applications?limit=1').then(r => unwrap<{ total: number }>(r)),
      api.get('/applications?limit=1&status=HIRED').then(r => unwrap<{ total: number }>(r)),
      api.get('/jobs?limit=1&status=ACTIVE').then(r => unwrap<{ total: number }>(r)),
      api.get('/users/stats').then(r => unwrap<{ total: number }>(r)),
    ]).then(([apps, hired, jobs, users]) => {
      setStats({
        applications: apps.status === 'fulfilled' ? (apps.value?.total ?? 0) : 0,
        hired: hired.status === 'fulfilled' ? (hired.value?.total ?? 0) : 0,
        activeJobs: jobs.status === 'fulfilled' ? (jobs.value?.total ?? 0) : 0,
        candidates: users.status === 'fulfilled' ? ((users.value as any)?.total ?? 0) : 0,
      });
    });
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'applications', label: 'Applications' },
    { key: 'jobs', label: 'Jobs' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Exports"
        subtitle="Recruitment analytics and data exports"
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Applications', value: stats.applications, color: 'text-gray-900 dark:text-white', icon: '📋' },
          { label: 'Hired', value: stats.hired, color: 'text-green-600 dark:text-green-400', icon: '✅' },
          { label: 'Active Jobs', value: stats.activeJobs, color: 'text-[#F77B0F]', icon: '💼' },
          { label: 'Platform Users', value: stats.candidates, color: 'text-blue-600 dark:text-blue-400', icon: '👥' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{s.label}</p>
              <span className="text-lg">{s.icon}</span>
            </div>
            <p className={`text-3xl font-black ${s.color}`}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'applications' && <ApplicationsTab />}
      {tab === 'jobs' && <JobsTab />}
    </div>
  );
}
