'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import api, { unwrap } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { formatDate, formatDateTime } from '@/lib/utils';

type ReportType = 'FAKE_JOB' | 'SPAM' | 'INAPPROPRIATE' | 'HARASSMENT' | 'OTHER';
type ReportStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

interface Report {
  id: string;
  type: ReportType;
  status: ReportStatus;
  reason?: string;
  description?: string;
  reportedAt: string;
  resolvedAt?: string;
  reporter?: { id: string; email: string; firstName?: string; lastName?: string };
  target?: { id: string; type: string; title?: string; name?: string };
}

const TYPE_BADGE: Record<ReportType, string> = {
  FAKE_JOB: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  SPAM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  INAPPROPRIATE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  HARASSMENT: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  OTHER: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_BADGE: Record<ReportStatus, string> = {
  OPEN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  UNDER_REVIEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DISMISSED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const ic = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors';

export default function ReportsPage() {
  const { addToast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; report: Report | null }>({ open: false, report: null });
  const [dismissDialog, setDismissDialog] = useState<{ open: boolean; report: Report | null }>({ open: false, report: null });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: '10' });
      if (typeFilter) p.set('type', typeFilter);
      if (statusFilter) p.set('status', statusFilter);
      const res = await api.get(`/reports?${p.toString()}`);
      const data = unwrap<any>(res);
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      const tot = data?.total ?? items.length;
      const tpages = data?.totalPages ?? Math.ceil(tot / 10) || 1;
      setReports(items);
      setTotal(tot);
      setTotalPages(tpages);
    } catch {
      // If /reports endpoint not available, show empty state
      setReports([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleResolve = async () => {
    if (!resolveDialog.report) return;
    setActionLoading(true);
    try {
      await api.patch(`/reports/${resolveDialog.report.id}/resolve`);
      addToast('success', 'Report marked as resolved');
      setResolveDialog({ open: false, report: null });
      fetchReports();
    } catch {
      addToast('error', 'Failed to resolve report');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (!dismissDialog.report) return;
    setActionLoading(true);
    try {
      await api.patch(`/reports/${dismissDialog.report.id}/dismiss`);
      addToast('success', 'Report dismissed');
      setDismissDialog({ open: false, report: null });
      fetchReports();
    } catch {
      addToast('error', 'Failed to dismiss report');
    } finally {
      setActionLoading(false);
    }
  };

  const cols: Column<Report>[] = [
    {
      key: 'reporter',
      label: 'Reporter',
      render: r => (
        <div>
          <p className="text-sm font-medium text-card-foreground">
            {r.reporter?.firstName ? `${r.reporter.firstName} ${r.reporter.lastName || ''}` : r.reporter?.email || 'Unknown'}
          </p>
          <p className="text-xs text-muted-foreground">{r.reporter?.email}</p>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: r => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[r.type] || 'bg-gray-100 text-gray-600'}`}>
          {r.type?.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'target',
      label: 'Target',
      render: r => (
        <div>
          <p className="text-sm text-card-foreground">{r.target?.title || r.target?.name || r.target?.id || '-'}</p>
          {r.target?.type && <p className="text-xs text-muted-foreground capitalize">{r.target.type.toLowerCase()}</p>}
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: r => (
        <p className="text-sm text-muted-foreground max-w-xs truncate">{r.reason || r.description || '-'}</p>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: r => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600'}`}>
          {r.status?.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'reportedAt',
      label: 'Date',
      sortable: true,
      render: r => <span className="text-xs text-muted-foreground">{formatDate(r.reportedAt)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: r => (
        <div className="flex items-center gap-1">
          {(r.status === 'OPEN' || r.status === 'UNDER_REVIEW') && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setResolveDialog({ open: true, report: r }); }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
              >
                Resolve
              </button>
              <button
                onClick={e => { e.stopPropagation(); setDismissDialog({ open: true, report: r }); }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Dismiss
              </button>
            </>
          )}
          {r.status === 'RESOLVED' && (
            <span className="text-xs text-muted-foreground">Resolved {r.resolvedAt ? formatDate(r.resolvedAt) : ''}</span>
          )}
          {r.status === 'DISMISSED' && (
            <span className="text-xs text-muted-foreground">Dismissed</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reports"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports' },
        ]}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className={`${ic} w-44`}>
          <option value="">All Types</option>
          <option value="FAKE_JOB">Fake Job</option>
          <option value="SPAM">Spam</option>
          <option value="INAPPROPRIATE">Inappropriate</option>
          <option value="HARASSMENT">Harassment</option>
          <option value="OTHER">Other</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={`${ic} w-40`}>
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
        {(typeFilter || statusFilter) && (
          <button
            onClick={() => { setTypeFilter(''); setStatusFilter(''); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Reports', value: total, color: 'text-card-foreground' },
            { label: 'Open', value: reports.filter(r => r.status === 'OPEN').length, color: 'text-red-600' },
            { label: 'Resolved', value: reports.filter(r => r.status === 'RESOLVED').length, color: 'text-green-600' },
            { label: 'Dismissed', value: reports.filter(r => r.status === 'DISMISSED').length, color: 'text-muted-foreground' },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <DataTable
        columns={cols}
        data={reports}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        keyExtractor={r => r.id}
        emptyMessage="No reports found"
      />

      <ConfirmDialog
        isOpen={resolveDialog.open}
        onClose={() => setResolveDialog({ open: false, report: null })}
        onConfirm={handleResolve}
        title="Resolve Report"
        message={`Mark this ${resolveDialog.report?.type?.replace(/_/g, ' ').toLowerCase()} report as resolved? This will close it and notify the reporter.`}
        confirmLabel="Resolve"
        confirmVariant="primary"
        loading={actionLoading}
      />

      <ConfirmDialog
        isOpen={dismissDialog.open}
        onClose={() => setDismissDialog({ open: false, report: null })}
        onConfirm={handleDismiss}
        title="Dismiss Report"
        message={`Dismiss this report? This indicates the report was unfounded or not actionable.`}
        confirmLabel="Dismiss"
        confirmVariant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
