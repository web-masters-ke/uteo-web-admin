'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { disputeService } from '@/lib/services/disputeService';
import { bookingService } from '@/lib/services/bookingService';
import api, { unwrap } from '@/lib/api';
import { Dispute, Booking } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatDate, formatDateTime, formatCurrency, truncate } from '@/lib/utils';

const DISPUTE_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED_RELEASE',
  'RESOLVED_REFUND',
  'CLOSED',
];

const DISPUTE_CATEGORIES = [
  { key: 'PAYMENT',    label: 'Payment Issue',   description: 'Payment not received, wrong amount, or billing error', priority: 'HIGH',     slaHours: 24 },
  { key: 'NO_SHOW',    label: 'No-Show',          description: "Trainer didn't show up or cancelled without notice",   priority: 'HIGH',     slaHours: 24 },
  { key: 'QUALITY',    label: 'Poor Quality',     description: 'Session quality was below expectations',              priority: 'MEDIUM',   slaHours: 48 },
  { key: 'MISCONDUCT', label: 'Misconduct',       description: 'Inappropriate behavior or unprofessional conduct',    priority: 'CRITICAL', slaHours: 4  },
  { key: 'FRAUD',      label: 'Fraud',            description: 'Suspected scam, false credentials, or deception',    priority: 'CRITICAL', slaHours: 4  },
  { key: 'TECHNICAL',  label: 'Technical Issue',  description: 'Platform or technical problems affected the session', priority: 'LOW',      slaHours: 72 },
  { key: 'OTHER',      label: 'Other',            description: 'Something else not covered above',                   priority: 'LOW',      slaHours: 72 },
] as const;

const CATEGORY_PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  HIGH:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  MEDIUM:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  LOW:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

interface DisputeStats {
  total: number;
  open: number;
  underReview: number;
  resolved: number;
  closed: number;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default function DisputesPage() {
  const { addToast } = useToast();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<DisputeStats>({ total: 0, open: 0, underReview: 0, resolved: 0, closed: 0 });

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDispute, setDetailDispute] = useState<Dispute | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Resolve modal
  const [resolveOpen, setResolveOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState('RELEASE_TO_TRAINER');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Assign + Comments
  const [assignableTeam, setAssignableTeam] = useState<any[]>([]);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<any[]>([]);
  const [commentIsInternal, setCommentIsInternal] = useState(false);
  const [commentSending, setCommentSending] = useState(false);
  const [commentUploading, setCommentUploading] = useState(false);

  // Escalate modal
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateTarget, setEscalateTarget] = useState<Dispute | null>(null);
  const [escalateNote, setEscalateNote] = useState('');
  const [escalateTo, setEscalateTo] = useState<'FINANCE_ADMIN' | 'SUPER_ADMIN'>('FINANCE_ADMIN');
  const [escalateBusy, setEscalateBusy] = useState(false);

  // Create dispute modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createBookingSearch, setCreateBookingSearch] = useState('');
  const [createBookings, setCreateBookings] = useState<Booking[]>([]);
  const [createBookingsLoading, setCreateBookingsLoading] = useState(false);
  const [createSelectedBooking, setCreateSelectedBooking] = useState<Booking | null>(null);
  const [createReason, setCreateReason] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const ic = 'px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50';

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const d = await disputeService.getAll({
        page,
        limit: 10,
        status: statusFilter || undefined,
      });
      setDisputes(d.items);
      setTotalPages(d.totalPages);
      setTotal(d.total);
    } catch {
      addToast('error', 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, addToast]);

  const fetchStats = useCallback(async () => {
    try {
      const [all, open, underReview, resolvedRelease, resolvedRefund, closed] = await Promise.all([
        disputeService.getAll({ limit: 1 }),
        disputeService.getAll({ limit: 1, status: 'OPEN' }),
        disputeService.getAll({ limit: 1, status: 'UNDER_REVIEW' }),
        disputeService.getAll({ limit: 1, status: 'RESOLVED_RELEASE' }),
        disputeService.getAll({ limit: 1, status: 'RESOLVED_REFUND' }),
        disputeService.getAll({ limit: 1, status: 'CLOSED' }),
      ]);
      setStats({
        total: all.total,
        open: open.total,
        underReview: underReview.total,
        resolved: resolvedRelease.total + resolvedRefund.total,
        closed: closed.total,
      });
    } catch { /* ignore stats errors */ }
  }, []);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Detail modal ────────────────────────────────────────────────────────────
  const openDetailModal = async (d: Dispute) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setComments([]);
    setNewComment('');
    setCommentAttachments([]);
    setCommentIsInternal(false);
    try {
      const [full, cmts, team] = await Promise.all([
        disputeService.getById(d.id),
        disputeService.listComments(d.id).catch(() => []),
        disputeService.assignableTeam().catch(() => []),
      ]);
      setDetailDispute(full);
      setComments(cmts);
      setAssignableTeam(team);
    } catch {
      addToast('error', 'Failed to load dispute details');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Assign ──────────────────────────────────────────────────────────────────
  const handleAssign = async (assigneeId: string) => {
    if (!detailDispute) return;
    setActionLoading(true);
    try {
      const updated = await disputeService.assign(detailDispute.id, assigneeId);
      setDetailDispute(updated);
      const cmts = await disputeService.listComments(detailDispute.id);
      setComments(cmts);
      addToast('success', 'Dispute assigned');
      setAssignDropdownOpen(false);
      fetchDisputes();
    } catch (e: any) { addToast('error', e?.response?.data?.message || 'Failed to assign'); }
    finally { setActionLoading(false); }
  };

  const handleUnassign = async () => {
    if (!detailDispute) return;
    setActionLoading(true);
    try {
      const updated = await disputeService.unassign(detailDispute.id);
      setDetailDispute(updated);
      const cmts = await disputeService.listComments(detailDispute.id);
      setComments(cmts);
      addToast('success', 'Assignment removed');
      fetchDisputes();
    } catch (e: any) { addToast('error', e?.response?.data?.message || 'Failed to unassign'); }
    finally { setActionLoading(false); }
  };

  // ── Comments ───────────────────────────────────────────────────────────────
  const handleAddComment = async () => {
    if (!detailDispute || !newComment.trim()) return;
    setCommentSending(true);
    try {
      await disputeService.addComment(detailDispute.id, newComment, commentAttachments.length ? commentAttachments : undefined, commentIsInternal);
      const cmts = await disputeService.listComments(detailDispute.id);
      setComments(cmts);
      setNewComment('');
      setCommentAttachments([]);
      setCommentIsInternal(false);
      addToast('success', 'Comment posted');
    } catch (e: any) { addToast('error', e?.response?.data?.message || 'Failed to post comment'); }
    finally { setCommentSending(false); }
  };

  async function uploadAttachment(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 600000, maxContentLength: Infinity, maxBodyLength: Infinity });
    const data = unwrap<any>(res);
    return { url: data?.url || '', name: file.name, mimeType: file.type };
  }

  // ── Resolve ─────────────────────────────────────────────────────────────────
  const handleResolve = async () => {
    if (!selectedDispute || !resolutionNotes.trim()) {
      addToast('error', 'Resolution notes are required');
      return;
    }
    setActionLoading(true);
    try {
      const statusMap: Record<string, string> = {
        RELEASE_TO_TRAINER: 'RESOLVED_RELEASE',
        REFUND_TO_CLIENT: 'RESOLVED_REFUND',
        NO_ACTION: 'CLOSED',
      };
      const backendStatus = statusMap[resolution] || 'CLOSED';
      await disputeService.resolve(selectedDispute.id, backendStatus, resolutionNotes);
      addToast('success', 'Dispute resolved');
      setResolveOpen(false);
      setSelectedDispute(null);
      setResolution('RELEASE_TO_TRAINER');
      setResolutionNotes('');
      setDetailOpen(false);
      setDetailDispute(null);
      fetchDisputes();
      fetchStats();
    } catch {
      addToast('error', 'Failed to resolve dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const openResolveModal = (d: Dispute) => {
    setSelectedDispute(d);
    setResolution('RELEASE_TO_TRAINER');
    setResolutionNotes('');
    setResolveOpen(true);
  };

  // ── Escalate ────────────────────────────────────────────────────────────────
  const openEscalate = (d: Dispute) => {
    setEscalateTarget(d);
    setEscalateNote('');
    setEscalateTo('FINANCE_ADMIN');
    setEscalateOpen(true);
  };

  const submitEscalate = async () => {
    if (!escalateTarget) return;
    if (!escalateNote.trim()) { addToast('error', 'Escalation reason is required'); return; }
    setEscalateBusy(true);
    try {
      await disputeService.escalate(escalateTarget.id, escalateNote.trim(), escalateTo);
      addToast('success', 'Dispute escalated');
      setEscalateOpen(false);
      setEscalateNote('');
      fetchDisputes();
      fetchStats();
      if (detailDispute?.id === escalateTarget.id) {
        const full = await disputeService.getById(escalateTarget.id);
        setDetailDispute(full);
      }
    } catch (e: any) {
      addToast('error', e?.response?.data?.message || 'Failed to escalate dispute');
    } finally {
      setEscalateBusy(false);
    }
  };

  // ── Create dispute ──────────────────────────────────────────────────────────
  const searchBookings = async (query?: string) => {
    setCreateBookingsLoading(true);
    try {
      const params: any = { limit: 20 };
      if (query && query.trim()) params.search = query.trim();
      const res = await bookingService.getAll(params);
      setCreateBookings(res.items || []);
    } catch {
      addToast('error', 'Failed to load bookings');
    } finally {
      setCreateBookingsLoading(false);
    }
  };

  const handleCreateDispute = async () => {
    if (!createSelectedBooking || !createReason.trim() || !createCategory) {
      addToast('error', 'Please select a booking, category, and provide a reason');
      return;
    }
    setCreateLoading(true);
    try {
      await disputeService.create({
        bookingId: createSelectedBooking.id,
        category: createCategory,
        reason: createReason,
        description: createDescription || undefined,
      });
      addToast('success', 'Dispute created');
      setCreateOpen(false);
      setCreateSelectedBooking(null);
      setCreateReason('');
      setCreateDescription('');
      setCreateCategory('');
      setCreateBookings([]);
      setCreateBookingSearch('');
      fetchDisputes();
      fetchStats();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to create dispute';
      addToast('error', typeof msg === 'string' ? msg : msg[0] || 'Failed to create dispute');
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Client-side search filter ───────────────────────────────────────────────
  const filteredDisputes = search
    ? disputes.filter(d => {
        const s = search.toLowerCase();
        const raisedByName = d.raisedBy ? `${d.raisedBy.firstName} ${d.raisedBy.lastName}`.toLowerCase() : '';
        const againstName = d.against ? `${d.against.firstName} ${d.against.lastName}`.toLowerCase() : '';
        return (
          raisedByName.includes(s) ||
          againstName.includes(s) ||
          d.reason.toLowerCase().includes(s) ||
          d.id.toLowerCase().includes(s)
        );
      })
    : disputes;

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns: Column<Dispute>[] = [
    {
      key: 'id',
      label: 'ID',
      render: (d) => (
        <span className="text-xs font-mono text-muted-foreground">{d.id.slice(0, 8)}</span>
      ),
    },
    {
      key: 'raisedBy',
      label: 'Raised By',
      render: (d) => (
        <span className="font-medium">
          {d.raisedBy ? `${d.raisedBy.firstName} ${d.raisedBy.lastName}` : '-'}
        </span>
      ),
    },
    {
      key: 'against',
      label: 'Against',
      render: (d) => (
        <div>
          <span>{d.against ? `${d.against.firstName} ${d.against.lastName}` : '-'}</span>
          {d.booking?.trainer?.trainerProfile?.firmName && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{d.booking.trainer.trainerProfile.firmName}</p>
          )}
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (d) => {
        const cat = d.category ? DISPUTE_CATEGORIES.find(c => c.key === d.category) : null;
        return (
          <div>
            {cat && (
              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mb-0.5 ${CATEGORY_PRIORITY_COLOR[cat.priority] || ''}`}>
                {cat.label}
              </span>
            )}
            <p className="text-sm text-muted-foreground" title={d.reason}>{truncate(d.reason, 35)}</p>
          </div>
        );
      },
    },
    {
      key: 'assignedTo',
      label: 'Assigned',
      render: (d: any) => {
        const a = d.assignedTo;
        if (!a) return <span className="text-xs text-muted-foreground italic">Unassigned</span>;
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-primary-500/10 flex items-center justify-center text-[9px] font-bold text-primary-600 shrink-0 overflow-hidden">
              {a.avatar ? <img src={a.avatar} alt="" className="w-full h-full object-cover" /> : `${(a.firstName?.[0] || '')}${(a.lastName?.[0] || '')}`.toUpperCase()}
            </div>
            <span className="text-xs">{a.firstName} {a.lastName?.[0]}.</span>
            {d._count?.comments > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-500/10 text-primary-600">💬 {d._count.comments}</span>}
          </div>
        );
      },
    },
    {
      key: 'escrow',
      label: 'Escrow',
      render: (d) => {
        const escrow = d.booking?.escrow;
        if (!escrow) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div className="text-xs">
            <span className="font-semibold">{formatCurrency(Number(escrow.amount))}</span>
            <span className={`ml-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
              escrow.status === 'FUNDED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
              escrow.status === 'RELEASED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
              'bg-muted text-muted-foreground'
            }`}>{escrow.status}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (d) => {
        const isUrgent = ['OPEN', 'UNDER_REVIEW'].includes(d.status) && daysSince(d.createdAt) > 7;
        return (
          <div className="flex items-center gap-1.5">
            <StatusBadge status={d.status} />
            {isUrgent && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 animate-pulse">
                URGENT
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (d) => (
        <div>
          <span className="text-sm text-muted-foreground">{formatDate(d.createdAt)}</span>
          {['OPEN', 'UNDER_REVIEW'].includes(d.status) && (
            <p className="text-[10px] text-muted-foreground">{daysSince(d.createdAt)}d ago</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (d) => (
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); openDetailModal(d); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors"
            title="View Detail"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          {d.status === 'OPEN' && (
            <button
              onClick={e => { e.stopPropagation(); openEscalate(d); }}
              className="p-1.5 rounded-lg hover:bg-muted text-amber-500 hover:text-amber-600 transition-colors"
              title="Escalate"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          )}
          {['OPEN', 'UNDER_REVIEW'].includes(d.status) && (
            <button
              onClick={e => { e.stopPropagation(); openResolveModal(d); }}
              className="p-1.5 rounded-lg hover:bg-muted text-green-500 hover:text-green-600 transition-colors"
              title="Resolve"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Disputes"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Disputes' }]}
        actions={
          <button
            onClick={() => { setCreateOpen(true); searchBookings(); }}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Dispute
          </button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatsCard
          label="Total"
          value={stats.total}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>}
        />
        <StatsCard
          label="Open"
          value={stats.open}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatsCard
          label="Under Review"
          value={stats.underReview}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
        />
        <StatsCard
          label="Resolved"
          value={stats.resolved}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatsCard
          label="Closed"
          value={stats.closed}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search disputes..."
            className={`${ic} w-52 pl-9`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className={`${ic} w-52`}
        >
          <option value="">All Statuses</option>
          {DISPUTE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        {(statusFilter || search) && (
          <button
            onClick={() => { setStatusFilter(''); setSearch(''); setPage(1); }}
            className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredDisputes}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        keyExtractor={(d) => d.id}
        onRowClick={(d) => openDetailModal(d)}
        emptyMessage="No disputes found"
      />

      {/* ==================== DETAIL MODAL ==================== */}
      <Modal isOpen={detailOpen} onClose={() => { setDetailOpen(false); setDetailDispute(null); }} title="Dispute Details" size="xl">
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : detailDispute ? (
          <div className="space-y-6">
            {/* Header row */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <StatusBadge status={detailDispute.status} />
                  {detailDispute.category && (() => {
                    const cat = DISPUTE_CATEGORIES.find(c => c.key === detailDispute.category);
                    return cat ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${CATEGORY_PRIORITY_COLOR[cat.priority] || ''}`}>
                        {cat.label}
                      </span>
                    ) : null;
                  })()}
                  {['OPEN', 'UNDER_REVIEW'].includes(detailDispute.status) && daysSince(detailDispute.createdAt) > 7 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">URGENT</span>
                  )}
                </div>
                <p className="text-xs font-mono text-muted-foreground">ID: {detailDispute.id}</p>
              </div>
              <div className="flex gap-2">
                {detailDispute.status === 'OPEN' && (
                  <button
                    onClick={() => openEscalate(detailDispute)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-600 text-xs font-medium hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
                  >
                    Escalate
                  </button>
                )}
                {['OPEN', 'UNDER_REVIEW'].includes(detailDispute.status) && (
                  <button
                    onClick={() => openResolveModal(detailDispute)}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-xs font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-semibold">Raised By</p>
                <p className="text-sm font-medium">{detailDispute.raisedBy ? `${detailDispute.raisedBy.firstName} ${detailDispute.raisedBy.lastName}` : '-'}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-semibold">Against</p>
                <p className="text-sm font-medium">{detailDispute.against ? `${detailDispute.against.firstName} ${detailDispute.against.lastName}` : '-'}</p>
                {detailDispute.booking?.trainer?.trainerProfile?.firmName && (
                  <p className="text-xs text-muted-foreground mt-0.5">{detailDispute.booking.trainer.trainerProfile.firmName}</p>
                )}
              </div>
            </div>

            {/* Reason + Description */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Reason</p>
                <p className="text-sm">{detailDispute.reason}</p>
              </div>
              {detailDispute.description && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{detailDispute.description}</p>
                </div>
              )}
            </div>

            {/* Booking Context */}
            {detailDispute.booking && (
              <div className="p-4 rounded-lg border border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Booking Details</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-semibold">{formatCurrency(Number(detailDispute.booking.amount))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Session Type</p>
                    <p className="font-medium">{detailDispute.booking.sessionType?.replace(/_/g, ' ') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Scheduled</p>
                    <p className="font-medium">{detailDispute.booking.scheduledAt ? formatDateTime(detailDispute.booking.scheduledAt) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-medium">{detailDispute.booking.duration ? `${detailDispute.booking.duration} min` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Booking Status</p>
                    <StatusBadge status={detailDispute.booking.status} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trainer</p>
                    <p className="font-medium">
                      {detailDispute.booking.trainer ? `${detailDispute.booking.trainer.firstName} ${detailDispute.booking.trainer.lastName}` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="font-medium">
                      {detailDispute.booking.client ? `${detailDispute.booking.client.firstName} ${detailDispute.booking.client.lastName}` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Booking ID</p>
                    <p className="font-mono text-xs">{detailDispute.bookingId.slice(0, 12)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Escrow Status */}
            {detailDispute.booking?.escrow && (
              <div className="p-4 rounded-lg border border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Escrow</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="text-lg font-bold">{formatCurrency(Number(detailDispute.booking.escrow.amount))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                      detailDispute.booking.escrow.status === 'FUNDED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                      detailDispute.booking.escrow.status === 'RELEASED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      detailDispute.booking.escrow.status === 'FROZEN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {detailDispute.booking.escrow.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Escrow ID</p>
                    <p className="font-mono text-xs">{detailDispute.booking.escrow.id?.slice(0, 12)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="p-4 rounded-lg border border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Timeline</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-1.5 rounded-full 0 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Dispute Opened</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(detailDispute.createdAt)}</p>
                  </div>
                </div>
                {detailDispute.booking?.statusLogs && detailDispute.booking.statusLogs
                  .filter(l => l.toStatus === 'DISPUTED')
                  .map((log) => (
                    <div key={log.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-red-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Booking marked as Disputed</p>
                        <p className="text-xs text-muted-foreground">
                          From: {log.fromStatus?.replace(/_/g, ' ') || 'N/A'} | {formatDateTime(log.createdAt)}
                        </p>
                        {log.reason && <p className="text-xs text-muted-foreground mt-0.5">Reason: {log.reason}</p>}
                      </div>
                    </div>
                  ))
                }
                {detailDispute.status !== 'OPEN' && detailDispute.status !== 'UNDER_REVIEW' && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">
                        {detailDispute.status === 'RESOLVED_RELEASE' ? 'Resolved - Released to Trainer' :
                         detailDispute.status === 'RESOLVED_REFUND' ? 'Resolved - Refunded to Client' :
                         detailDispute.status === 'CLOSED' ? 'Closed' :
                         detailDispute.status.replace(/_/g, ' ')}
                      </p>
                      {detailDispute.resolvedAt && (
                        <p className="text-xs text-muted-foreground">{formatDateTime(detailDispute.resolvedAt)}</p>
                      )}
                      {detailDispute.resolvedBy && (
                        <p className="text-xs text-muted-foreground">By: {detailDispute.resolvedBy.firstName} {detailDispute.resolvedBy.lastName}</p>
                      )}
                      {detailDispute.resolution && (
                        <p className="text-xs mt-1 text-muted-foreground">Notes: {detailDispute.resolution}</p>
                      )}
                    </div>
                  </div>
                )}
                {detailDispute.status === 'UNDER_REVIEW' && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-amber-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Escalated to Under Review</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(detailDispute.updatedAt)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── ASSIGNMENT ── */}
            <div className="p-4 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Assigned To</h3>
                {(detailDispute as any).assignedTo ? (
                  <button onClick={handleUnassign} disabled={actionLoading} className="text-xs text-red-500 hover:text-red-700 font-medium">Unassign</button>
                ) : null}
              </div>
              {(detailDispute as any).assignedTo ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center text-sm font-bold text-primary-600 shrink-0 overflow-hidden">
                    {(detailDispute as any).assignedTo.avatar ? <img src={(detailDispute as any).assignedTo.avatar} className="w-full h-full object-cover" alt="" /> : `${((detailDispute as any).assignedTo.firstName?.[0] || '')}${((detailDispute as any).assignedTo.lastName?.[0] || '')}`.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{(detailDispute as any).assignedTo.firstName} {(detailDispute as any).assignedTo.lastName}</p>
                    <p className="text-xs text-muted-foreground">{(detailDispute as any).assignedTo.role}</p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <button onClick={() => setAssignDropdownOpen(!assignDropdownOpen)} disabled={actionLoading} className="w-full text-left px-3 py-2 rounded-lg border border-dashed border-border hover:bg-muted text-sm text-muted-foreground">
                    + Assign to a team member
                  </button>
                  {assignDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {assignableTeam.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">No team members available</p>
                      ) : (
                        assignableTeam.map((m: any) => (
                          <button key={m.id} onClick={() => handleAssign(m.id)} className="w-full flex items-center gap-3 p-3 hover:bg-muted text-left">
                            <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center text-xs font-bold text-primary-600 shrink-0 overflow-hidden">
                              {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover" alt="" /> : `${(m.firstName?.[0] || '')}${(m.lastName?.[0] || '')}`.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{m.firstName} {m.lastName}</p>
                              <p className="text-xs text-muted-foreground truncate">{m.email} · {m.role}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── COMMENTS / EVIDENCE THREAD ── */}
            <div className="p-4 rounded-lg border border-border">
              <h3 className="text-sm font-semibold mb-3">Comments & Evidence ({comments.length})</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Start the conversation below.</p>
                ) : (
                  comments.map((c: any) => (
                    <div key={c.id} className={`p-3 rounded-lg ${c.isInternal ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-muted/50'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-primary-500/10 flex items-center justify-center text-[10px] font-bold text-primary-600 shrink-0 overflow-hidden">
                          {c.author?.avatar ? <img src={c.author.avatar} className="w-full h-full object-cover" alt="" /> : `${(c.author?.firstName?.[0] || '')}${(c.author?.lastName?.[0] || '')}`.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold">{c.author?.firstName} {c.author?.lastName} <span className="text-muted-foreground font-normal">· {c.author?.role}</span></p>
                          <p className="text-[10px] text-muted-foreground">{formatDateTime(c.createdAt)}</p>
                        </div>
                        {c.isInternal && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">INTERNAL</span>}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                      {c.attachments && Array.isArray(c.attachments) && c.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {c.attachments.map((a: any, ai: number) => (
                            <a key={ai} href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded bg-card border border-border hover:bg-muted inline-flex items-center gap-1">
                              📎 {a.name || 'attachment'}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              {/* New comment form */}
              <div className="space-y-2 border-t border-border pt-3">
                <textarea
                  rows={3}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Add a comment, context, or evidence..."
                  className={`${ic} w-full resize-none`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" onChange={async e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setCommentUploading(true);
                      try { const att = await uploadAttachment(f); setCommentAttachments([...commentAttachments, att]); addToast('success', `${f.name} attached`); }
                      catch { addToast('error', 'Upload failed'); }
                      finally { setCommentUploading(false); }
                    }} />
                    <span className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted inline-flex items-center gap-1">
                      {commentUploading ? 'Uploading...' : '📎 Attach'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={commentIsInternal} onChange={e => setCommentIsInternal(e.target.checked)} />
                    Internal note (admins/assignee only)
                  </label>
                  <button onClick={handleAddComment} disabled={commentSending || commentUploading || !newComment.trim()} className="ml-auto px-4 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50">
                    {commentSending ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
                {commentAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {commentAttachments.map((a: any, ai: number) => (
                      <span key={ai} className="text-xs px-2 py-1 rounded bg-card border border-border inline-flex items-center gap-1">
                        📎 {a.name}
                        <button onClick={() => setCommentAttachments(commentAttachments.filter((_, i) => i !== ai))} className="text-red-500 hover:text-red-700 ml-1">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ==================== RESOLVE DISPUTE MODAL ==================== */}
      <Modal isOpen={resolveOpen} onClose={() => setResolveOpen(false)} title="Resolve Dispute" size="md">
        <div className="space-y-5">
          {/* Summary */}
          {selectedDispute && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Dispute ID</span>
                <span className="font-mono text-xs">{selectedDispute.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={selectedDispute.status} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Raised By</span>
                <span className="font-medium">
                  {selectedDispute.raisedBy ? `${selectedDispute.raisedBy.firstName} ${selectedDispute.raisedBy.lastName}` : '-'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Against</span>
                <span className="font-medium">
                  {selectedDispute.against ? `${selectedDispute.against.firstName} ${selectedDispute.against.lastName}` : '-'}
                </span>
              </div>
              {selectedDispute.booking && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Booking Amount</span>
                  <span className="font-medium">{formatCurrency(Number(selectedDispute.booking.amount))}</span>
                </div>
              )}
              {selectedDispute.booking?.escrow && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Escrow at Stake</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(Number(selectedDispute.booking.escrow.amount))}</span>
                </div>
              )}
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">Reason</p>
                <p className="text-sm">{selectedDispute.reason}</p>
              </div>
            </div>
          )}

          {/* Resolution radio buttons */}
          <div>
            <label className="block text-sm font-medium mb-3">Resolution *</label>
            <div className="space-y-2">
              {[
                { value: 'RELEASE_TO_TRAINER', label: 'Release to Trainer', desc: 'Release the escrowed funds to the trainer' },
                { value: 'REFUND_TO_CLIENT', label: 'Refund to Client', desc: 'Refund the escrowed funds back to the client' },
                { value: 'NO_ACTION', label: 'Close Without Action', desc: 'Close the dispute without financial action' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    resolution === opt.value
                      ? 'border-primary-500 bg-primary-500/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="resolution"
                    value={opt.value}
                    checked={resolution === opt.value}
                    onChange={(e) => setResolution(e.target.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Resolution Notes *</label>
            <textarea
              value={resolutionNotes}
              onChange={e => setResolutionNotes(e.target.value)}
              rows={4}
              placeholder="Explain the resolution decision..."
              className={`w-full ${ic}`}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={() => setResolveOpen(false)} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={actionLoading || !resolutionNotes.trim()}
              className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
            >
              {actionLoading ? 'Resolving...' : 'Resolve Dispute'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== CREATE DISPUTE MODAL ==================== */}
      <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); setCreateSelectedBooking(null); setCreateBookings([]); setCreateBookingSearch(''); setCreateReason(''); setCreateDescription(''); setCreateCategory(''); }} title="Create Dispute" size="lg">
        <div className="space-y-5">
          {/* Step 1: Search and select booking */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Select Booking *</label>
            <div className="flex gap-2 mb-3">
              <input
                value={createBookingSearch}
                onChange={e => setCreateBookingSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') searchBookings(createBookingSearch); }}
                placeholder="Search by client/trainer name or booking ID..."
                className={`flex-1 ${ic}`}
              />
              <button
                onClick={() => searchBookings(createBookingSearch)}
                disabled={createBookingsLoading}
                className="px-4 py-2 rounded-lg bg-muted text-card-foreground text-sm font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                {createBookingsLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {createSelectedBooking && (
              <div className="p-3 rounded-lg border border-primary-500 bg-primary-500/5 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {createSelectedBooking.client?.firstName} {createSelectedBooking.client?.lastName} / {(createSelectedBooking.trainer as any)?.firstName || (createSelectedBooking.trainer as any)?.user?.firstName || 'Trainer'} {(createSelectedBooking.trainer as any)?.lastName || (createSelectedBooking.trainer as any)?.user?.lastName || ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(Number(createSelectedBooking.amount))} | {createSelectedBooking.status} | {formatDate(createSelectedBooking.scheduledAt || createSelectedBooking.createdAt)}
                    </p>
                  </div>
                  <button onClick={() => setCreateSelectedBooking(null)} className="text-xs text-red-500 hover:text-red-600">Remove</button>
                </div>
              </div>
            )}

            {!createSelectedBooking && createBookings.length > 0 && (
              <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
                {createBookings.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setCreateSelectedBooking(b)}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-sm font-medium">
                      {b.client?.firstName} {b.client?.lastName} / {(b.trainer as any)?.firstName || (b.trainer as any)?.user?.firstName || 'Trainer'} {(b.trainer as any)?.lastName || (b.trainer as any)?.user?.lastName || ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(Number(b.amount))} | {b.status} | {formatDate(b.scheduledAt || b.createdAt)} | ID: {b.id.slice(0, 8)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Category picker */}
          <div>
            <label className="block text-sm font-medium mb-2">Category * <span className="text-xs text-muted-foreground font-normal">— determines SLA tier</span></label>
            <div className="grid grid-cols-2 gap-2">
              {DISPUTE_CATEGORIES.map(cat => {
                const selected = createCategory === cat.key;
                const priorityColor = CATEGORY_PRIORITY_COLOR[cat.priority] || '';
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCreateCategory(cat.key)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      selected
                        ? 'border-primary-500 bg-primary-500/5 ring-1 ring-primary-500/30'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{cat.label}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priorityColor}`}>
                        {cat.slaHours}h SLA
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">{cat.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Reason + Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Reason *</label>
            <input
              value={createReason}
              onChange={e => setCreateReason(e.target.value)}
              placeholder="Brief reason for the dispute..."
              className={`w-full ${ic}`}
              maxLength={500}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={createDescription}
              onChange={e => setCreateDescription(e.target.value)}
              rows={4}
              placeholder="Detailed description of the issue..."
              className={`w-full ${ic}`}
              maxLength={2000}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={() => setCreateOpen(false)} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreateDispute}
              disabled={createLoading || !createSelectedBooking || !createCategory || !createReason.trim()}
              className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
            >
              {createLoading ? 'Creating...' : 'Create Dispute'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Escalate Modal ────────────────────────────────────────── */}
      <Modal
        isOpen={escalateOpen}
        onClose={() => { if (!escalateBusy) { setEscalateOpen(false); setEscalateNote(''); } }}
        title="Escalate Dispute"
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg p-3 bg-[#F77B0F]/10 border border-[#F77B0F]/30">
            <p className="text-xs text-foreground">
              Escalation moves this dispute to a higher authority level. A public audit comment will be added automatically.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">Escalate to *</label>
            <div className="space-y-2">
              <label className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${escalateTo === 'FINANCE_ADMIN' ? 'border-[#F77B0F]/60 bg-[#F77B0F]/5' : 'border-border hover:bg-muted'}`}>
                <input type="radio" name="escalateTo" value="FINANCE_ADMIN" checked={escalateTo === 'FINANCE_ADMIN'} onChange={() => setEscalateTo('FINANCE_ADMIN')} className="mt-0.5 h-4 w-4 accent-[#F77B0F]" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Finance / Admin (L2)</p>
                  <p className="text-xs text-muted-foreground">Finance and admin team reviews and acts on the case.</p>
                </div>
              </label>
              <label className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${escalateTo === 'SUPER_ADMIN' ? 'border-red-400/60 bg-red-500/5' : 'border-border hover:bg-muted'}`}>
                <input type="radio" name="escalateTo" value="SUPER_ADMIN" checked={escalateTo === 'SUPER_ADMIN'} onChange={() => setEscalateTo('SUPER_ADMIN')} className="mt-0.5 h-4 w-4 accent-red-500" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Super Admin (L3)</p>
                  <p className="text-xs text-muted-foreground">Final escalation. Use only for critical or unresolved cases.</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">Reason / Note *</label>
            <textarea
              rows={4}
              value={escalateNote}
              onChange={e => setEscalateNote(e.target.value)}
              placeholder="Explain why this dispute needs to be escalated..."
              maxLength={2000}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-[#F77B0F] outline-none resize-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{escalateNote.length}/2000</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => { if (!escalateBusy) { setEscalateOpen(false); setEscalateNote(''); } }}
              disabled={escalateBusy}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={submitEscalate}
              disabled={escalateBusy || !escalateNote.trim()}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-[#F77B0F] text-white hover:bg-[#e36d04] disabled:opacity-50 flex items-center gap-2"
            >
              {escalateBusy && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {escalateBusy ? 'Escalating...' : 'Escalate Dispute'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
