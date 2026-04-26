'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { applicationAdminService, AdminApplication, UpdateApplicationStatusPayload } from '@/lib/services/applicationAdminService';
import { useToast } from '@/lib/toast';
import { formatDate, formatDateTime } from '@/lib/utils';

const ic = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:border-[#F77B0F] focus:ring-1 focus:ring-[#F77B0F] transition-colors';
const inp = 'w-full px-4 py-2.5 rounded-xl border border-border bg-card text-card-foreground text-sm focus:outline-none focus:border-[#F77B0F] focus:ring-1 focus:ring-[#F77B0F] transition-colors';
const lbl = 'block text-xs font-medium text-muted-foreground mb-1.5';

// These match the ApplicationStatus enum in Prisma exactly
const STATUSES = [
  { key: 'SUBMITTED',   label: 'Submitted',   dot: 'bg-gray-400',    col: 'bg-gray-50 dark:bg-gray-800/60' },
  { key: 'REVIEWED',    label: 'Reviewed',    dot: 'bg-blue-500',    col: 'bg-blue-50 dark:bg-blue-900/20' },
  { key: 'SHORTLISTED', label: 'Shortlisted', dot: 'bg-yellow-500',  col: 'bg-yellow-50 dark:bg-yellow-900/20' },
  { key: 'INTERVIEW',   label: 'Interview',   dot: 'bg-purple-500',  col: 'bg-purple-50 dark:bg-purple-900/20' },
  { key: 'HIRED',       label: 'Hired',       dot: 'bg-emerald-500', col: 'bg-emerald-50 dark:bg-emerald-900/20' },
  { key: 'REJECTED',    label: 'Rejected',    dot: 'bg-red-500',     col: 'bg-red-50 dark:bg-red-900/20' },
];

function applicantName(a: AdminApplication) {
  return a.user.firstName || a.user.lastName
    ? `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim()
    : a.user.email;
}

// ── Kanban ───────────────────────────────────────────────────────────────────

function KanbanBoard({ applications, onMove, onCardClick }: {
  applications: AdminApplication[];
  onMove: (id: string, status: string) => void;
  onCardClick: (app: AdminApplication) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-6" style={{ minHeight: 520 }}>
      {STATUSES.map(stage => {
        const cards = applications.filter(a => a.status === stage.key);
        const isOver = overCol === stage.key;
        return (
          <div key={stage.key}
            className={`flex-shrink-0 w-56 rounded-2xl border border-border flex flex-col transition-colors ${stage.col} ${isOver ? 'ring-2 ring-[#F77B0F]/40' : ''}`}
            onDragOver={e => { e.preventDefault(); setOverCol(stage.key); }}
            onDragLeave={() => setOverCol(null)}
            onDrop={() => { if (dragId) onMove(dragId, stage.key); setDragId(null); setOverCol(null); }}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                <span className="text-xs font-bold text-card-foreground">{stage.label}</span>
              </div>
              <span className="text-[10px] bg-card rounded-full px-1.5 py-0.5 text-muted-foreground font-medium border border-border">{cards.length}</span>
            </div>
            {/* Cards */}
            <div className="flex flex-col gap-2 p-2 flex-1">
              {cards.map(app => (
                <div key={app.id} draggable
                  onDragStart={() => setDragId(app.id)}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  onClick={() => onCardClick(app)}
                  className={`bg-card rounded-xl border border-border p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all ${dragId === app.id ? 'opacity-50 scale-95' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full bg-[#F77B0F]/10 flex items-center justify-center text-[10px] font-bold text-[#F77B0F] shrink-0">
                      {(app.user.firstName?.[0] || app.user.email[0]).toUpperCase()}
                    </div>
                    <p className="text-xs font-semibold text-card-foreground truncate">{applicantName(app)}</p>
                  </div>
                  <p className="text-[10px] text-card-foreground font-medium truncate">{app.job?.title || '-'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{app.job?.company?.name || '-'}</p>
                  <p className="text-[10px] text-muted-foreground mt-1.5">{formatDate(app.appliedAt)}</p>
                </div>
              ))}
              {cards.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[10px] text-muted-foreground/50">Drop here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Detail slide-over ────────────────────────────────────────────────────────

interface DetailPanelProps {
  app: AdminApplication | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (updated: AdminApplication) => void;
  onDeleted: (id: string) => void;
}

function DetailPanel({ app, open, onClose, onUpdated, onDeleted }: DetailPanelProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ status: '', notes: '', scheduledAt: '', meetingLink: '' });

  useEffect(() => {
    if (app) {
      setForm({
        status: app.status,
        notes: app.notes || '',
        scheduledAt: app.scheduledAt ? app.scheduledAt.slice(0, 16) : '',
        meetingLink: app.meetingLink || '',
      });
    }
  }, [app]);

  const handleSave = async () => {
    if (!app) return;
    setSaving(true);
    try {
      const payload: UpdateApplicationStatusPayload = {
        status: form.status,
        notes: form.notes || undefined,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        meetingLink: form.meetingLink || undefined,
      };
      const updated = await applicationAdminService.updateStatus(app.id, payload);
      addToast('success', 'Application updated');
      onUpdated({ ...app, ...updated });
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      addToast('error', Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!app) return;
    setDeleting(true);
    try {
      await applicationAdminService.delete(app.id);
      addToast('success', 'Application deleted');
      onDeleted(app.id);
      onClose();
    } catch {
      addToast('error', 'Failed to delete application');
    } finally {
      setDeleting(false);
      setDelConfirm(false);
    }
  };

  if (!open || !app) return null;

  const currentStage = STATUSES.find(s => s.key === app.status);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-background border-l border-border flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#F77B0F]/10 flex items-center justify-center text-sm font-bold text-[#F77B0F] shrink-0">
              {(app.user.firstName?.[0] || app.user.email[0]).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-card-foreground text-sm">{applicantName(app)}</p>
              <p className="text-xs text-muted-foreground">{app.user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Job summary card */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Position</p>
            <p className="font-semibold text-card-foreground">{app.job?.title}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{app.job?.company?.name}</span>
              {app.job?.location && <><span>·</span><span>{app.job.location}</span></>}
              {app.job?.jobType && <><span>·</span><span>{app.job.jobType.replace(/_/g, ' ')}</span></>}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className={`w-2 h-2 rounded-full ${currentStage?.dot || 'bg-gray-400'}`} />
              <span className="text-xs font-medium text-card-foreground">{currentStage?.label || app.status}</span>
              <span className="text-muted-foreground text-xs">· Applied {formatDate(app.appliedAt)}</span>
            </div>
          </div>

          {/* Status + actions */}
          <div className="space-y-4 rounded-2xl border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Update Application</p>
            <div>
              <label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            {(form.status === 'INTERVIEW') && (
              <>
                <div>
                  <label className={lbl}>Interview Date &amp; Time</label>
                  <input type="datetime-local" value={form.scheduledAt}
                    onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Meeting Link</label>
                  <input type="url" value={form.meetingLink} onChange={e => setForm(p => ({ ...p, meetingLink: e.target.value }))}
                    placeholder="https://meet.google.com/…" className={inp} />
                </div>
              </>
            )}
            <div>
              <label className={lbl}>Internal Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={3} placeholder="Notes visible only to admin and recruiters…" className={`${inp} resize-none`} />
            </div>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline disabled:opacity-50">
              {saving ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#F77B0F] border-t-transparent" />Saving…</> : 'Save changes →'}
            </button>
          </div>

          {/* Cover letter */}
          {app.coverLetter && (
            <div className="rounded-2xl border border-border p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cover Letter</p>
              <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed max-h-52 overflow-y-auto">
                {app.coverLetter}
              </div>
            </div>
          )}

          {/* Resume */}
          {app.resumeUrl && (
            <div className="rounded-2xl border border-border p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Resume</p>
                <p className="text-xs text-muted-foreground truncate max-w-[260px]">{app.resumeUrl}</p>
              </div>
              <a href={app.resumeUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm font-semibold text-[#F77B0F] hover:underline shrink-0">
                Open ↗
              </a>
            </div>
          )}

          {/* Interview details (if already set) */}
          {app.scheduledAt && (
            <div className="rounded-2xl border border-border p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interview Scheduled</p>
              <p className="text-sm text-card-foreground font-medium">{formatDateTime(app.scheduledAt)}</p>
              {app.meetingLink && (
                <a href={app.meetingLink} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[#F77B0F] hover:underline">
                  Join meeting ↗
                </a>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="text-xs text-muted-foreground space-y-1 pt-1">
            <p>Application ID: <span className="font-mono">{app.id}</span></p>
            <p>Last updated: {formatDateTime(app.updatedAt)}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          <button onClick={() => setDelConfirm(true)}
            className="text-xs font-medium text-red-500 hover:underline transition-colors">
            Delete application
          </button>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-card-foreground transition-colors">
            Close
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={delConfirm} onClose={() => setDelConfirm(false)} onConfirm={handleDelete}
        title="Delete Application"
        message={`Remove ${applicantName(app)}'s application for "${app.job?.title}"? This cannot be undone.`}
        confirmLabel="Delete" confirmVariant="danger" loading={deleting}
      />
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

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
      const data = await applicationAdminService.list({ page, limit: LIMIT, search, status: statusFilter, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
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
    try {
      const full = await applicationAdminService.get(app.id);
      setSelectedApp(full);
    } catch {
      setSelectedApp(app);
    }
    setDetailOpen(true);
  };

  const handleMove = async (appId: string, newStatus: string) => {
    const prev = applications.find(a => a.id === appId);
    if (!prev || prev.status === newStatus) return;
    setApplications(p => p.map(a => a.id === appId ? { ...a, status: newStatus } : a));
    try {
      await applicationAdminService.updateStatus(appId, { status: newStatus });
      addToast('success', `Moved to ${STATUSES.find(s => s.key === newStatus)?.label}`);
    } catch {
      setApplications(p => p.map(a => a.id === appId ? { ...a, status: prev.status } : a));
      addToast('error', 'Failed to move application');
    }
  };

  const handleUpdated = (updated: AdminApplication) => {
    setApplications(p => p.map(a => a.id === updated.id ? { ...a, ...updated } : a));
    setSelectedApp(updated);
  };

  const handleDeleted = (id: string) => {
    setApplications(p => p.filter(a => a.id !== id));
    setTotal(p => p - 1);
  };

  const cols: Column<AdminApplication>[] = [
    {
      key: 'applicant', label: 'Applicant',
      render: a => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#F77B0F]/10 flex items-center justify-center text-[10px] font-bold text-[#F77B0F] shrink-0">
            {(a.user.firstName?.[0] || a.user.email[0]).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-card-foreground text-sm">{applicantName(a)}</p>
            <p className="text-xs text-muted-foreground">{a.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'job', label: 'Position',
      render: a => (
        <div>
          <p className="font-medium text-sm text-card-foreground truncate max-w-[180px]">{a.job?.title || '-'}</p>
          <p className="text-xs text-muted-foreground">{a.job?.company?.name || '-'}</p>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: a => <StatusBadge status={a.status} /> },
    {
      key: 'appliedAt', label: 'Applied', sortable: true,
      render: a => <span className="text-muted-foreground text-sm">{formatDate(a.appliedAt)}</span>,
    },
    {
      key: 'actions', label: '',
      render: a => (
        <div onClick={e => e.stopPropagation()}>
          <select value="" onChange={e => { if (e.target.value) handleMove(a.id, e.target.value); }}
            className="text-xs px-2 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
            <option value="">Move to…</option>
            {STATUSES.filter(s => s.key !== a.status).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Applications"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Applications' }]}
        actions={
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(['table', 'kanban'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  viewMode === mode ? 'bg-card text-card-foreground shadow-sm' : 'text-muted-foreground hover:text-card-foreground'
                }`}>
                {mode === 'table' ? 'Table' : 'Kanban'}
              </button>
            ))}
          </div>
        }
      />
      <p className="text-sm text-muted-foreground -mt-4 mb-5">All job applications across the platform. Drag cards in Kanban to move stages.</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search applicant or job…" className={`${ic} w-64 pl-9`} />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={`${ic} w-44`}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className={`${ic} w-38`} title="From" />
          <span className="text-muted-foreground text-sm">–</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className={`${ic} w-38`} title="To" />
        </div>
        {(search || statusFilter || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-card-foreground hover:bg-muted rounded-lg transition-colors">
            Clear
          </button>
        )}
      </div>

      {viewMode === 'kanban' ? (
        <KanbanBoard applications={applications} onMove={handleMove} onCardClick={openDetail} />
      ) : (
        <DataTable columns={cols} data={applications} loading={loading} page={page} totalPages={totalPages}
          total={total} onPageChange={setPage} keyExtractor={a => a.id} onRowClick={openDetail} emptyMessage="No applications found" />
      )}

      <DetailPanel
        app={selectedApp} open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedApp(null); }}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
