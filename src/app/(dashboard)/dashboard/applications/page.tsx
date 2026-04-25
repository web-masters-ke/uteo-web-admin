'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { applicationAdminService, AdminApplication } from '@/lib/services/applicationAdminService';
import { useToast } from '@/lib/toast';
import { formatDate, formatDateTime } from '@/lib/utils';
import api from '@/lib/api';

const ic = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors';

const KANBAN_STAGES = [
  { key: 'PENDING', label: 'New', color: 'bg-gray-100 dark:bg-gray-800' },
  { key: 'UNDER_REVIEW', label: 'Under Review', color: 'bg-blue-50 dark:bg-blue-900/20' },
  { key: 'SHORTLISTED', label: 'Shortlisted', color: 'bg-yellow-50 dark:bg-yellow-900/20' },
  { key: 'INTERVIEW', label: 'Interview', color: 'bg-purple-50 dark:bg-purple-900/20' },
  { key: 'OFFERED', label: 'Offered', color: 'bg-orange-50 dark:bg-orange-900/20' },
  { key: 'HIRED', label: 'Hired', color: 'bg-green-50 dark:bg-green-900/20' },
  { key: 'REJECTED', label: 'Rejected', color: 'bg-red-50 dark:bg-red-900/20' },
];

const STAGE_DOT: Record<string, string> = {
  PENDING: 'bg-gray-400', UNDER_REVIEW: 'bg-blue-500', SHORTLISTED: 'bg-yellow-500',
  INTERVIEW: 'bg-purple-500', OFFERED: 'bg-orange-500', HIRED: 'bg-green-500', REJECTED: 'bg-red-500',
};

function KanbanBoard({ applications, onMoveStage, onCardClick }: {
  applications: AdminApplication[];
  onMoveStage: (id: string, status: string) => void;
  onCardClick: (app: AdminApplication) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 500 }}>
      {KANBAN_STAGES.map(stage => {
        const cards = applications.filter(a => a.status === stage.key);
        return (
          <div
            key={stage.key}
            className={`flex-shrink-0 w-56 rounded-xl border border-border ${stage.color} flex flex-col`}
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (dragId) onMoveStage(dragId, stage.key); setDragId(null); }}
          >
            <div className="px-3 py-2 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${STAGE_DOT[stage.key]}`} />
                <span className="text-xs font-bold text-card-foreground">{stage.label}</span>
              </div>
              <span className="text-xs bg-card rounded-full px-1.5 py-0.5 text-muted-foreground font-medium">{cards.length}</span>
            </div>
            <div className="flex flex-col gap-2 p-2 flex-1 min-h-[60px]">
              {cards.map(app => (
                <div
                  key={app.id}
                  draggable
                  onDragStart={() => setDragId(app.id)}
                  onClick={() => onCardClick(app)}
                  className="bg-card rounded-lg border border-border p-2.5 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
                >
                  <p className="text-xs font-semibold text-card-foreground truncate">
                    {app.user.firstName || app.user.lastName
                      ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim()
                      : app.user.email}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{app.job?.title || '-'}</p>
                  <p className="text-[10px] text-muted-foreground">{app.job?.company?.name || '-'}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{formatDate(app.appliedAt)}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ApplicationsPage() {
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

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

  const moveStage = async (appId: string, newStatus: string) => {
    try {
      await api.patch(`/applications/${appId}/status`, { status: newStatus });
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
      addToast('success', 'Stage updated');
    } catch {
      addToast('error', 'Failed to update stage');
    }
  };

  return (
    <div>
      <PageHeader
        title="Applications"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Applications' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-[#F77B0F] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'kanban' ? 'bg-[#F77B0F] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              Kanban
            </button>
          </div>
        }
      />
      <p className="text-sm text-muted-foreground -mt-4 mb-5">
        Overview of all job applications. Drag cards in Kanban view to move stages.
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

      {viewMode === 'kanban' ? (
        <KanbanBoard applications={applications} onMoveStage={moveStage} onCardClick={openDetail} />
      ) : (
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
      )}

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
