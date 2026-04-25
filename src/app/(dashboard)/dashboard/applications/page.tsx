'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { applicationAdminService, AdminApplication } from '@/lib/services/applicationAdminService';
import { useToast } from '@/lib/toast';
import { formatDate, formatDateTime } from '@/lib/utils';

const ic = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors';

export default function ApplicationsPage() {
  const { addToast } = useToast();

  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 15;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedApp, setSelectedApp] = useState<AdminApplication | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await applicationAdminService.list({
        page,
        limit: LIMIT,
        search,
        status: statusFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setApplications(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / LIMIT)));
    } catch {
      addToast('error', 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, dateFrom, dateTo, addToast]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const openDetail = async (app: AdminApplication) => {
    // Attempt to load full detail; fall back to list item
    try {
      const full = await applicationAdminService.get(app.id);
      setSelectedApp(full);
    } catch {
      setSelectedApp(app);
    }
    setDetailOpen(true);
  };

  const cols: Column<AdminApplication>[] = [
    {
      key: 'applicant',
      label: 'Applicant',
      render: a => (
        <div>
          <p className="font-medium text-card-foreground">
            {a.user.firstName || a.user.lastName
              ? `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim()
              : a.user.email}
          </p>
          <p className="text-xs text-muted-foreground">{a.user.email}</p>
        </div>
      ),
    },
    {
      key: 'job',
      label: 'Job',
      render: a => (
        <div>
          <p className="font-medium text-sm text-card-foreground truncate max-w-[180px]">{a.job?.title || '-'}</p>
          <p className="text-xs text-muted-foreground">{a.job?.company?.name || '-'}</p>
        </div>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      render: a => <span className="text-sm">{a.job?.company?.name || '-'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: a => <StatusBadge status={a.status} />,
    },
    {
      key: 'appliedAt',
      label: 'Applied',
      sortable: true,
      render: a => <span className="text-muted-foreground text-sm">{formatDate(a.appliedAt)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Applications"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Applications' }]}
      />
      <p className="text-sm text-muted-foreground -mt-4 mb-5">
        Read-only overview of all job applications across the platform.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search applicant or job..."
            className={`${ic} w-64 pl-9`}
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={`${ic} w-44`}>
          <option value="">All Statuses</option>
          {['PENDING', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className={`${ic} w-40`}
            title="From date"
          />
          <span className="text-muted-foreground text-sm">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className={`${ic} w-40`}
            title="To date"
          />
        </div>
        {(search || statusFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <DataTable
        columns={cols}
        data={applications}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        keyExtractor={a => a.id}
        onRowClick={openDetail}
        emptyMessage="No applications found"
      />

      {/* ========== Application detail modal ========== */}
      <Modal isOpen={detailOpen} onClose={() => { setDetailOpen(false); setSelectedApp(null); }} title="Application Detail" size="md">
        {selectedApp && (
          <div className="space-y-5">
            {/* Applicant */}
            <div className="p-4 rounded-lg bg-muted/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center text-sm font-bold text-primary-500">
                {(selectedApp.user.firstName?.[0] || selectedApp.user.email[0]).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-card-foreground">
                  {selectedApp.user.firstName || selectedApp.user.lastName
                    ? `${selectedApp.user.firstName || ''} ${selectedApp.user.lastName || ''}`.trim()
                    : selectedApp.user.email}
                </p>
                <p className="text-xs text-muted-foreground">{selectedApp.user.email}</p>
              </div>
            </div>

            {/* Job info */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Job</span>
                <span className="font-medium">{selectedApp.job?.title || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Company</span>
                <span className="font-medium">{selectedApp.job?.company?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Applied</span>
                <span className="font-medium">{formatDateTime(selectedApp.appliedAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={selectedApp.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Application ID</span>
                <span className="font-mono text-xs text-muted-foreground">{selectedApp.id}</span>
              </div>
            </div>

            {/* Cover letter */}
            {selectedApp.coverLetter && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Cover Letter</p>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
                  {selectedApp.coverLetter}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border flex justify-end">
              <button
                onClick={() => { setDetailOpen(false); setSelectedApp(null); }}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
