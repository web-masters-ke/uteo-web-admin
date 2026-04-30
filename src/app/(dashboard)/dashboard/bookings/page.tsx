'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { bookingService } from '@/lib/services/bookingService';
import { userService } from '@/lib/services/userService';
import { trainerService } from '@/lib/services/trainerService';
import { Booking, User, Trainer, PaginatedResponse } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

const BOOKING_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'NO_SHOW'];
const SESSION_TYPES = ['VIRTUAL', 'PHYSICAL', 'HYBRID', 'PRE_RECORDED'];

interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  disputed: number;
}

export default function BookingsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [data, setData] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState<BookingStats>({ total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, disputed: 0 });

  // Status change modal
  const [statusModal, setStatusModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Cancel confirm dialog
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);

  // Create booking modal
  const [createOpen, setCreateOpen] = useState(false);
  const [clientFocused, setClientFocused] = useState(false);
  const [trainerFocused, setTrainerFocused] = useState(false);
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [newClient, setNewClient] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [createForm, setCreateForm] = useState({
    clientSearch: '', trainerSearch: '',
    clientId: '', trainerId: '',
    clientName: '', trainerName: '',
    sessionType: 'VIRTUAL' as string,
    scheduledAt: '', duration: 60, amount: 0, notes: '',
  });
  const [clientResults, setClientResults] = useState<User[]>([]);
  const [trainerResults, setTrainerResults] = useState<Trainer[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [searchingTrainers, setSearchingTrainers] = useState(false);

  // Create booking — advanced options
  const [createGroupSession, setCreateGroupSession] = useState(false);
  const [createMaxParticipants, setCreateMaxParticipants] = useState(10);
  const [createBreakoutRooms, setCreateBreakoutRooms] = useState(false);
  const [createBreakoutCount, setCreateBreakoutCount] = useState(2);
  const [createBreakoutMode, setCreateBreakoutMode] = useState<'auto' | 'manual'>('auto');
  const [createRecordSession, setCreateRecordSession] = useState(false);
  const [createTimezone, setCreateTimezone] = useState('Africa/Nairobi');
  const [createReminders, setCreateReminders] = useState<string[]>(['24h']);

  const ic = 'px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50';
  const icFull = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors';

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const d = await bookingService.getAll({
        page, limit: 10, search: search || undefined,
        status: statusFilter || undefined,
        sessionType: sessionTypeFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setData(d.items);
      setTotalPages(d.totalPages);
      setTotal(d.total);
    } catch {
      addToast('error', 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sessionTypeFilter, startDate, endDate, addToast]);

  const fetchStats = useCallback(async () => {
    try {
      const [all, pending, confirmed, completed, cancelled, disputed] = await Promise.all([
        bookingService.getAll({ limit: 1 }),
        bookingService.getAll({ limit: 1, status: 'PENDING_PAYMENT' }),
        bookingService.getAll({ limit: 1, status: 'CONFIRMED' }),
        bookingService.getAll({ limit: 1, status: 'COMPLETED' }),
        bookingService.getAll({ limit: 1, status: 'CANCELLED' }),
        bookingService.getAll({ limit: 1, status: 'DISPUTED' }),
      ]);
      setStats({
        total: all.total,
        pending: pending.total,
        confirmed: confirmed.total,
        completed: completed.total,
        cancelled: cancelled.total,
        disputed: disputed.total,
      });
    } catch { /* ignore stats errors */ }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Search clients
  const searchClients = useCallback(async (query: string) => {
    setSearchingClients(true);
    try {
      const params: any = { role: 'CLIENT', limit: 10 };
      if (query && query.length >= 1) params.search = query;
      const result = await userService.getAll(params);
      setClientResults(result.items || []);
    } catch { setClientResults([]); }
    finally { setSearchingClients(false); }
  }, []);

  // Search trainers
  const searchTrainers = useCallback(async (query: string) => {
    setSearchingTrainers(true);
    try {
      const params: any = { limit: 10 };
      if (query && query.length >= 1) params.search = query;
      const result = await trainerService.getAll(params);
      setTrainerResults(result.items || []);
    } catch { setTrainerResults([]); }
    finally { setSearchingTrainers(false); }
  }, []);

  // Search on typing (debounced) — only when focused
  useEffect(() => {
    if (!clientFocused || createForm.clientId) return;
    const t = setTimeout(() => searchClients(createForm.clientSearch), 300);
    return () => clearTimeout(t);
  }, [createForm.clientSearch, clientFocused, createForm.clientId, searchClients]);

  useEffect(() => {
    if (!trainerFocused || createForm.trainerId) return;
    const t = setTimeout(() => searchTrainers(createForm.trainerSearch), 300);
    return () => clearTimeout(t);
  }, [createForm.trainerSearch, trainerFocused, createForm.trainerId, searchTrainers]);

  const handleStatusChange = async () => {
    if (!selectedBooking || !newStatus) return;
    setActionLoading(true);
    try {
      switch (newStatus) {
        case 'CONFIRMED': await bookingService.confirm(selectedBooking.id); break;
        case 'COMPLETED': await bookingService.complete(selectedBooking.id); break;
        case 'CANCELLED': await bookingService.cancel(selectedBooking.id, statusReason); break;
        case 'DISPUTED': await bookingService.dispute(selectedBooking.id, statusReason); break;
        default: addToast('error', 'Invalid status'); return;
      }
      addToast('success', `Booking status changed to ${newStatus}`);
      setStatusModal(false);
      setSelectedBooking(null);
      setNewStatus('');
      setStatusReason('');
      fetchBookings();
      fetchStats();
    } catch {
      addToast('error', 'Failed to change status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickCancel = async () => {
    if (!cancelBooking) return;
    setActionLoading(true);
    try {
      await bookingService.cancel(cancelBooking.id, 'Cancelled by admin');
      addToast('success', 'Booking cancelled');
      setCancelDialog(false);
      setCancelBooking(null);
      fetchBookings();
      fetchStats();
    } catch {
      addToast('error', 'Failed to cancel booking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async () => {
    const hasClient = clientMode === 'new' ? (newClient.firstName && newClient.email) : createForm.clientId;
    if (!hasClient || !createForm.trainerId) {
      addToast('error', clientMode === 'new' ? 'Fill client name and email, and select a trainer' : 'Please select both a client and a trainer');
      return;
    }
    if (!createForm.scheduledAt) {
      addToast('error', 'Please select a date and time');
      return;
    }
    if (Number(createForm.amount) <= 0) {
      addToast('error', 'Please enter a valid amount');
      return;
    }
    setActionLoading(true);
    try {
      const bookingPayload: Record<string, unknown> = {
        trainerId: createForm.trainerId,
        sessionType: createForm.sessionType,
        scheduledAt: new Date(createForm.scheduledAt).toISOString(),
        duration: Number(createForm.duration),
        amount: Number(createForm.amount),
        notes: createForm.notes || undefined,
        location: (createForm as any).location || undefined,
        meetingLink: (createForm as any).meetingLink || undefined,
        timezone: createTimezone,
        ...(createReminders.length > 0 ? { reminders: createReminders } : {}),
        ...(createRecordSession ? { recordSession: true } : {}),
        ...(createGroupSession ? { isGroupSession: true, maxParticipants: createMaxParticipants } : {}),
        ...(createGroupSession && createBreakoutRooms ? { breakoutRooms: { count: createBreakoutCount, assignMode: createBreakoutMode } } : {}),
      };
      if (clientMode === 'existing') {
        bookingPayload.clientId = createForm.clientId;
      } else {
        bookingPayload.clientEmail = newClient.email;
        bookingPayload.clientName = `${newClient.firstName} ${newClient.lastName}`.trim();
        bookingPayload.clientPhone = newClient.phone || undefined;
      }
      await bookingService.create(bookingPayload);
      addToast('success', 'Booking created');
      setCreateOpen(false);
      setCreateForm({
        clientSearch: '', trainerSearch: '',
        clientId: '', trainerId: '',
        clientName: '', trainerName: '',
        sessionType: 'VIRTUAL', scheduledAt: '', duration: 60, amount: 0, notes: '',
      });
      setCreateGroupSession(false); setCreateMaxParticipants(10);
      setCreateBreakoutRooms(false); setCreateBreakoutCount(2); setCreateBreakoutMode('auto');
      setCreateRecordSession(false); setCreateTimezone('Africa/Nairobi'); setCreateReminders(['24h']);
      fetchBookings();
      fetchStats();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.data?.message || 'Failed to create booking';
      addToast('error', typeof msg === 'string' ? msg : 'Failed to create booking');
    } finally {
      setActionLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setSessionTypeFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasFilters = search || statusFilter || sessionTypeFilter || startDate || endDate;

  const cols: Column<Booking>[] = [
    {
      key: 'id', label: 'ID',
      render: b => <span className="text-xs font-mono text-muted-foreground">{b.id.slice(0, 8)}</span>,
    },
    {
      key: 'client', label: 'Client',
      render: b => {
        const c = b.client as any;
        return <span className="font-medium">{c?.firstName} {c?.lastName}</span>;
      },
    },
    {
      key: 'trainer', label: 'Trainer',
      render: b => {
        const t = b.trainer as any;
        return (
          <div>
            <span className="font-medium">{t?.firstName || ''} {t?.lastName || ''}</span>
            {t?.trainerProfile?.firmName && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{t.trainerProfile.firmName}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'organization', label: 'Organization',
      render: b => {
        const t = b.trainer as any;
        const membership = t?.teamMembership?.[0];
        if (!membership) return <span className="text-xs text-muted-foreground">Independent</span>;
        const firmName = t?.trainerProfile?.firmName || `${membership.firm?.firstName || ''} ${membership.firm?.lastName || ''}`.trim();
        const dept = membership.department?.name;
        return (
          <div>
            <span className="text-xs font-medium">{firmName || 'Organization'}</span>
            {dept && <p className="text-[10px] text-muted-foreground">{dept}</p>}
          </div>
        );
      },
    },
    {
      key: 'scheduledAt', label: 'Date/Time', sortable: true,
      render: b => <span className="text-sm">{formatDateTime(b.scheduledAt)}</span>,
    },
    {
      key: 'duration', label: 'Duration',
      render: b => <span className="text-sm">{b.duration}m</span>,
    },
    {
      key: 'amount', label: 'Amount', sortable: true,
      render: b => <span className="font-medium">{formatCurrency(Number(b.amount))}</span>,
    },
    {
      key: 'sessionType', label: 'Type',
      render: b => (
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {(b.sessionType || '').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: b => <StatusBadge status={b.status} />,
    },
    {
      key: 'actions', label: '',
      render: b => (
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); router.push(`/dashboard/bookings/${b.id}`); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors"
            title="View Detail"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); setSelectedBooking(b); setNewStatus(''); setStatusReason(''); setStatusModal(true); }}
            className="p-1.5 rounded-lg hover:bg-muted text-blue-500 hover:text-blue-600 transition-colors"
            title="Change Status"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {!['COMPLETED', 'CANCELLED'].includes(b.status) && (
            <button
              onClick={e => { e.stopPropagation(); setCancelBooking(b); setCancelDialog(true); }}
              className="p-1.5 rounded-lg hover:bg-muted text-red-500 hover:text-red-600 transition-colors"
              title="Cancel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
        title="Bookings"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Bookings' }]}
        actions={
          <button
            onClick={() => {
              setCreateForm({
                clientSearch: '', trainerSearch: '',
                clientId: '', trainerId: '',
                clientName: '', trainerName: '',
                sessionType: 'IN_PERSON', scheduledAt: '', duration: 60, amount: 0, notes: '',
              });
              setClientResults([]);
              setTrainerResults([]);
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Booking
          </button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatsCard
          label="Total"
          value={stats.total}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
        <StatsCard
          label="Pending"
          value={stats.pending}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatsCard
          label="Confirmed"
          value={stats.confirmed}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatsCard
          label="Completed"
          value={stats.completed}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
        />
        <StatsCard
          label="Cancelled"
          value={stats.cancelled}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
        />
        <StatsCard
          label="Disputed"
          value={stats.disputed}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search client/trainer..."
            className={`${ic} w-52 pl-9`}
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={`${ic} w-40`}>
          <option value="">All Statuses</option>
          {BOOKING_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={sessionTypeFilter} onChange={e => { setSessionTypeFilter(e.target.value); setPage(1); }} className={`${ic} w-40`}>
          <option value="">All Types</option>
          {SESSION_TYPES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} className={ic} placeholder="From" />
        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} className={ic} placeholder="To" />
        {hasFilters && (
          <button onClick={clearFilters} className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
            Clear all
          </button>
        )}
      </div>

      <DataTable
        columns={cols}
        data={data}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        keyExtractor={b => b.id}
        onRowClick={b => router.push(`/dashboard/bookings/${b.id}`)}
        emptyMessage="No bookings found"
      />

      {/* ==================== STATUS CHANGE MODAL ==================== */}
      <Modal isOpen={statusModal} onClose={() => setStatusModal(false)} title="Change Booking Status" size="sm">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p><span className="text-muted-foreground">Booking:</span> <span className="font-mono">{selectedBooking?.id.slice(0, 8)}</span></p>
            <p className="mt-1"><span className="text-muted-foreground">Current:</span> <StatusBadge status={selectedBooking?.status || ''} /></p>
            <p className="mt-1"><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{selectedBooking ? formatCurrency(Number(selectedBooking.amount)) : '-'}</span></p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Status *</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className={`w-full ${ic}`}>
              <option value="">Select...</option>
              {['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED'].filter(s => s !== selectedBooking?.status).map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          {(newStatus === 'CANCELLED' || newStatus === 'DISPUTED') && (
            <div>
              <label className="block text-sm font-medium mb-1">Reason *</label>
              <textarea value={statusReason} onChange={e => setStatusReason(e.target.value)} rows={3} placeholder="Provide a reason..." className={`w-full ${ic}`} />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={() => setStatusModal(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button
              onClick={handleStatusChange}
              disabled={actionLoading || !newStatus || ((newStatus === 'CANCELLED' || newStatus === 'DISPUTED') && !statusReason)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
            >
              {actionLoading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== CANCEL CONFIRM ==================== */}
      <ConfirmDialog
        isOpen={cancelDialog}
        onClose={() => { setCancelDialog(false); setCancelBooking(null); }}
        onConfirm={handleQuickCancel}
        title="Cancel Booking"
        message={`Are you sure you want to cancel booking ${cancelBooking?.id.slice(0, 8)}? This action will cancel the booking and trigger any applicable refund processes.`}
        confirmLabel="Cancel Booking"
        confirmVariant="danger"
        loading={actionLoading}
      />

      {/* ==================== CREATE BOOKING MODAL ==================== */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Booking" size="lg">
        <div className="space-y-5">
          {/* Client */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Client *</label>
              <div className="flex gap-1">
                <button type="button" onClick={() => { setClientMode('existing'); setNewClient({ firstName: '', lastName: '', email: '', phone: '' }); }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${clientMode === 'existing' ? 'border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  Existing
                </button>
                <button type="button" onClick={() => { setClientMode('new'); setCreateForm({ ...createForm, clientId: '', clientName: '', clientSearch: '' }); }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${clientMode === 'new' ? 'border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  + New Client
                </button>
              </div>
            </div>

            {clientMode === 'new' ? (
              <div className="space-y-2 p-3 rounded-lg border border-blue-200 dark:border-blue-800 /50 dark:bg-blue-900/10">
                <div className="grid grid-cols-2 gap-2">
                  <input value={newClient.firstName} onChange={e => setNewClient({ ...newClient, firstName: e.target.value })} placeholder="First name *" className={icFull} />
                  <input value={newClient.lastName} onChange={e => setNewClient({ ...newClient, lastName: e.target.value })} placeholder="Last name *" className={icFull} />
                </div>
                <input type="email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} placeholder="Email address *" className={icFull} />
                <input value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} placeholder="Phone (optional)" className={icFull} />
              </div>
            ) : createForm.clientId ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div>
                  <p className="text-sm font-medium">{createForm.clientName}</p>
                  <p className="text-xs text-muted-foreground">Selected</p>
                </div>
                <button onClick={() => setCreateForm({ ...createForm, clientId: '', clientName: '', clientSearch: '' })} className="text-xs text-red-500 hover:text-red-600">Remove</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={createForm.clientSearch}
                  onChange={e => setCreateForm({ ...createForm, clientSearch: e.target.value })}
                  onFocus={() => { setClientFocused(true); searchClients(createForm.clientSearch); }}
                  onBlur={() => setTimeout(() => setClientFocused(false), 200)}
                  placeholder="Search clients by name or email..."
                  className={icFull}
                />
                {searchingClients && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                  </div>
                )}
                {clientFocused && clientResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {clientResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setCreateForm({ ...createForm, clientId: u.id, clientName: `${u.firstName} ${u.lastName}`, clientSearch: '' });
                          setClientResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm transition-colors"
                      >
                        <span className="font-medium">{u.firstName} {u.lastName}</span>
                        <span className="text-muted-foreground ml-2">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trainer Search */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Trainer / Organization *</label>
            {createForm.trainerId ? (
              <div className="flex items-center justify-between p-3 rounded-lg  border border-blue-200 dark:border-blue-800">
                <div>
                  <p className="text-sm font-medium">{createForm.trainerName}</p>
                  <p className="text-xs text-muted-foreground">Selected</p>
                </div>
                <button
                  onClick={() => setCreateForm({ ...createForm, trainerId: '', trainerName: '', trainerSearch: '' })}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={createForm.trainerSearch}
                  onChange={e => setCreateForm({ ...createForm, trainerSearch: e.target.value })}
                  onFocus={() => { setTrainerFocused(true); searchTrainers(createForm.trainerSearch); }}
                  onBlur={() => setTimeout(() => setTrainerFocused(false), 200)}
                  placeholder="Search trainers & organizations..."
                  className={icFull}
                />
                {searchingTrainers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                  </div>
                )}
                {trainerFocused && trainerResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {trainerResults.map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setCreateForm({
                            ...createForm,
                            trainerId: t.user?.id || t.id,
                            trainerName: `${t.user?.firstName} ${t.user?.lastName}`,
                            trainerSearch: '',
                            amount: Number(t.hourlyRate) || createForm.amount,
                          });
                          setTrainerResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{t.user?.firstName} {t.user?.lastName}</span>
                          <span className="text-primary-500">{formatCurrency(Number(t.hourlyRate))}/hr</span>
                          {(t as any).isOrganization && <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold">🏢 {(t as any).firmName || 'Organization'} · {(t as any).teamSize} members</span>}
                          {!(t as any).isOrganization && (t as any).memberRole && <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-medium">{(t as any).memberRole}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{t.specialization || ''} {t.trainerType === 'VOCATIONAL' ? '· Blue Collar' : t.trainerType === 'PROFESSIONAL' ? '· White Collar' : ''} {!(t as any).isOrganization && (t as any).belongsToFirm ? '· Part of an org' : ''}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Session Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Session Type *</label>
              <select
                value={createForm.sessionType}
                onChange={e => setCreateForm({ ...createForm, sessionType: e.target.value })}
                className={icFull}
              >
                {SESSION_TYPES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Date & Time *</label>
              <input
                type="datetime-local"
                value={createForm.scheduledAt}
                onChange={e => setCreateForm({ ...createForm, scheduledAt: e.target.value })}
                className={icFull}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Duration (minutes) *</label>
              <input
                type="number"
                min="15"
                step="15"
                value={createForm.duration}
                onChange={e => setCreateForm({ ...createForm, duration: Number(e.target.value) })}
                className={icFull}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Amount (KES) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">KES</span>
                <input
                  type="number"
                  min="0"
                  value={createForm.amount || ''}
                  onChange={e => setCreateForm({ ...createForm, amount: Number(e.target.value) })}
                  placeholder="0"
                  className={`${icFull} pl-12`}
                />
              </div>
            </div>
          </div>

          {/* Location — for PHYSICAL or HYBRID */}
          {(createForm.sessionType === 'PHYSICAL' || createForm.sessionType === 'HYBRID') && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Location *</label>
              <input
                value={(createForm as any).location || ''}
                onChange={e => setCreateForm({ ...createForm, location: e.target.value } as any)}
                placeholder="e.g. Nairobi CBD, Karen Office Park"
                className={icFull}
              />
            </div>
          )}

          {/* Meeting URL — for VIRTUAL or HYBRID */}
          {(createForm.sessionType === 'VIRTUAL' || createForm.sessionType === 'HYBRID') && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Meeting Link</label>
              <input
                value={(createForm as any).meetingLink || ''}
                onChange={e => setCreateForm({ ...createForm, meetingLink: e.target.value } as any)}
                placeholder="Auto-generated if left blank"
                className={icFull}
              />
              <p className="text-xs text-muted-foreground mt-1">Leave blank to auto-generate a secure video session link.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <textarea
              value={createForm.notes}
              onChange={e => setCreateForm({ ...createForm, notes: e.target.value })}
              rows={2}
              placeholder="Optional notes..."
              className={icFull}
            />
          </div>

          {/* ── Advanced Options ── */}
          <div className="rounded-xl border border-border p-4 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Advanced Options</p>

            {/* Toggles row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Group Session */}
              <div className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition-colors ${createGroupSession ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-border hover:border-border/80'}`}
                onClick={() => setCreateGroupSession(v => !v)}>
                <div>
                  <p className="text-xs font-semibold">Group Session</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Multiple participants</p>
                </div>
                <div className={`relative inline-flex h-5 w-10 items-center rounded-full border-2 transition-colors ${createGroupSession ? 'bg-primary-500 border-primary-500' : 'bg-muted border-transparent'}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${createGroupSession ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </div>
              </div>

              {/* Record Session */}
              <div className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition-colors ${createRecordSession ? 'border-red-400 bg-red-50 dark:bg-red-900/10' : 'border-border hover:border-border/80'}`}
                onClick={() => setCreateRecordSession(v => !v)}>
                <div>
                  <p className="text-xs font-semibold">Record Session</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Save for later review</p>
                </div>
                <div className={`relative inline-flex h-5 w-10 items-center rounded-full border-2 transition-colors ${createRecordSession ? 'bg-red-500 border-red-500' : 'bg-muted border-transparent'}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${createRecordSession ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </div>

            {/* Group Session expanded */}
            {createGroupSession && (
              <div className="space-y-3 pl-1">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Max Participants: <span className="text-foreground font-semibold">{createMaxParticipants}</span>
                  </label>
                  <input type="range" min={2} max={50} value={createMaxParticipants}
                    onChange={e => setCreateMaxParticipants(Number(e.target.value))}
                    className="w-full accent-primary-500" />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5"><span>2</span><span>50</span></div>
                </div>

                {/* Breakout rooms */}
                <div className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition-colors ${createBreakoutRooms ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-border'}`}
                  onClick={() => setCreateBreakoutRooms(v => !v)}>
                  <div>
                    <p className="text-xs font-semibold">Breakout Rooms</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Split into smaller groups</p>
                  </div>
                  <div className={`relative inline-flex h-5 w-10 items-center rounded-full border-2 transition-colors ${createBreakoutRooms ? 'bg-primary-500 border-primary-500' : 'bg-muted border-transparent'}`}>
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${createBreakoutRooms ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </div>
                </div>

                {createBreakoutRooms && (
                  <div className="space-y-3 pl-1">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">
                        Rooms: <span className="text-foreground font-semibold">{createBreakoutCount}</span>
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {[2,3,4,5,6,7,8,9,10].map(n => (
                          <button key={n} type="button" onClick={() => setCreateBreakoutCount(n)}
                            className={`w-9 h-9 rounded-lg text-xs font-semibold border-2 transition-all ${createBreakoutCount === n ? 'border-primary-500 bg-primary-500 text-white' : 'border-border text-foreground hover:border-primary-300'}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'auto' as const, label: 'Auto-assign', desc: 'System distributes' },
                        { value: 'manual' as const, label: 'Manual', desc: 'You assign' },
                      ]).map(opt => (
                        <button key={opt.value} type="button" onClick={() => setCreateBreakoutMode(opt.value)}
                          className={`p-2.5 rounded-lg border-2 text-left transition-all ${createBreakoutMode === opt.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-border hover:border-border/60'}`}>
                          <p className="text-xs font-semibold">{opt.label}</p>
                          <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timezone */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Timezone</label>
              <select value={createTimezone} onChange={e => setCreateTimezone(e.target.value)} className={icFull}>
                <option value="Africa/Nairobi">Africa/Nairobi (EAT, UTC+3)</option>
                <option value="Africa/Lagos">Africa/Lagos (WAT, UTC+1)</option>
                <option value="Africa/Johannesburg">Africa/Johannesburg (SAST, UTC+2)</option>
                <option value="Africa/Cairo">Africa/Cairo (EET, UTC+2)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET, UTC+1)</option>
                <option value="America/New_York">America/New_York (EST, UTC-5)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            {/* Reminders */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Client Reminders</label>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: '24h', label: '24h before' },
                  { value: '1h', label: '1h before' },
                  { value: '15m', label: '15min before' },
                ]).map(r => {
                  const on = createReminders.includes(r.value);
                  return (
                    <button key={r.value} type="button"
                      onClick={() => setCreateReminders(prev => on ? prev.filter(x => x !== r.value) : [...prev, r.value])}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${on ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10 text-primary-700 dark:text-primary-300' : 'border-border text-muted-foreground hover:border-border/60'}`}>
                      <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center text-[8px] transition-all ${on ? 'bg-primary-500 border-primary-500 text-white' : 'border-muted-foreground'}`}>
                        {on && '✓'}
                      </span>
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cancellation policy notice */}
            <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 p-3">
              <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                <strong>Cancellation policy:</strong> &gt;48h = 100% refund · 24–48h = 50% refund · &lt;24h = no refund
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={() => setCreateOpen(false)} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={actionLoading || !createForm.clientId || !createForm.trainerId || !createForm.scheduledAt || Number(createForm.amount) <= 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                  Creating...
                </>
              ) : 'Create Booking'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
