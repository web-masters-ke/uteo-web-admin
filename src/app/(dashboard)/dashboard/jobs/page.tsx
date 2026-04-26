'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { jobService, AdminJob } from '@/lib/services/jobService';
import { useToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';

const ic = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors';

export default function JobsPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 10;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');

  const [delDialog, setDelDialog] = useState<{ open: boolean; job: AdminJob | null }>({ open: false, job: null });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jobService.list({ page, limit: LIMIT, search, status: statusFilter, jobType: jobTypeFilter });
      setJobs(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / LIMIT)));
    } catch {
      addToast('error', 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, jobTypeFilter, addToast]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleStatusChange = async (job: AdminJob, status: string) => {
    // Optimistic update — reflect immediately in the table
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status } : j));
    try {
      await jobService.updateStatus(job.id, status);
      addToast('success', `Job marked as ${status.toLowerCase()}`);
      fetchJobs();
    } catch {
      // Revert on failure
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: job.status } : j));
      addToast('error', 'Failed to update job status');
    }
  };

  const handleDelete = async () => {
    if (!delDialog.job) return;
    const deletedId = delDialog.job.id;
    setDelDialog({ open: false, job: null });
    // Optimistic remove from list
    setJobs(prev => prev.filter(j => j.id !== deletedId));
    setTotal(prev => prev - 1);
    try {
      await jobService.delete(deletedId);
      addToast('success', 'Job deleted');
      fetchJobs();
    } catch {
      addToast('error', 'Failed to delete job');
      fetchJobs(); // restore on failure
    }
  };

  const cols: Column<AdminJob>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: j => (
        <div>
          <p className="font-medium text-card-foreground truncate max-w-[200px]">{j.title}</p>
        </div>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      render: j => (
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{j.company?.name || '-'}</span>
          {j.company?.isVerified && (
            <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          )}
        </div>
      ),
    },
    {
      key: 'jobType',
      label: 'Type',
      render: j => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-500/10 text-primary-500">
          {(j.jobType || '-').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      render: j => <span className="text-muted-foreground text-sm">{j.location || '-'}</span>,
    },
    {
      key: 'salary',
      label: 'Salary',
      render: j => (
        <span className="text-sm text-muted-foreground">
          {j.salaryMin || j.salaryMax
            ? `${j.salaryMin ? j.salaryMin.toLocaleString() : '?'} – ${j.salaryMax ? j.salaryMax.toLocaleString() : '?'}`
            : '-'}
        </span>
      ),
    },
    {
      key: 'applications',
      label: 'Applicants',
      render: j => (
        <span className="font-medium text-sm">{j._count?.applications ?? 0}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: j => <StatusBadge status={j.status} />,
    },
    {
      key: 'createdAt',
      label: 'Posted',
      sortable: true,
      render: j => <span className="text-muted-foreground text-sm">{formatDate(j.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: j => (
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          {/* Status dropdown */}
          <select
            value=""
            onChange={e => { if (e.target.value) handleStatusChange(j, e.target.value); }}
            disabled={actionLoading}
            className="text-xs px-2 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
            title="Change status"
          >
            <option value="">Status</option>
            {['ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'].filter(s => s !== j.status).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {/* Delete */}
          <button
            onClick={() => setDelDialog({ open: true, job: j })}
            className="p-1.5 rounded-lg hover:bg-muted text-red-500 hover:text-red-600 transition-colors"
            title="Delete job"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Jobs"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Jobs' }]}
      />
      <p className="text-sm text-muted-foreground -mt-4 mb-5">Review and moderate job postings</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search jobs..."
            className={`${ic} w-64 pl-9`}
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={`${ic} w-40`}>
          <option value="">All Statuses</option>
          {['ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={jobTypeFilter} onChange={e => { setJobTypeFilter(e.target.value); setPage(1); }} className={`${ic} w-44`}>
          <option value="">All Types</option>
          {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE', 'REMOTE'].map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {(search || statusFilter || jobTypeFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setJobTypeFilter(''); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <DataTable
        columns={cols}
        data={jobs}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        keyExtractor={j => j.id}
        onRowClick={j => router.push(`/dashboard/jobs/${j.id}`)}
        emptyMessage="No jobs found"
      />

      <ConfirmDialog
        isOpen={delDialog.open}
        onClose={() => setDelDialog({ open: false, job: null })}
        onConfirm={handleDelete}
        title="Delete Job"
        message={`Are you sure you want to delete "${delDialog.job?.title}"? This action cannot be undone and will remove all associated applications.`}
        confirmLabel="Delete Job"
        confirmVariant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
