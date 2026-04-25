'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { bookingService } from '@/lib/services/bookingService';
import { escrowService } from '@/lib/services/escrowService';
import { Booking, Escrow } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

const Icon = ({ d }: { d: string }) => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

interface BookingWithEscrow extends Booking {
  escrow?: Escrow;
}

type EscrowAction = 'release' | 'refund' | 'freeze';

export default function EscrowPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<BookingWithEscrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  // Detail modal
  const [detailModal, setDetailModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithEscrow | null>(null);

  // Action confirmation
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    booking: BookingWithEscrow | null;
    action: EscrowAction | null;
  }>({ open: false, booking: null, action: null });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const d = await bookingService.getAll({ page, limit: 50 });
      const allBookings = d.items as BookingWithEscrow[];
      let withEscrow = allBookings.filter((b) => b.escrow || b.escrowId);
      if (statusFilter) {
        withEscrow = withEscrow.filter((b) => b.escrow?.status === statusFilter);
      }
      setData(withEscrow);
      setTotalPages(d.totalPages);
      setTotal(withEscrow.length);
    } catch {
      addToast('error', 'Failed to load escrow accounts');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalAmount = data.reduce((sum, b) => sum + Number(b.escrow?.amount || b.amount || 0), 0);
  const pendingCount = data.filter(
    (b) => b.escrow?.status === 'PENDING' || b.escrow?.status === 'FUNDED'
  ).length;
  const releasedCount = data.filter((b) => b.escrow?.status === 'RELEASED').length;
  const frozenCount = data.filter((b) => b.escrow?.status === 'FROZEN').length;

  const handleAction = async () => {
    if (!actionDialog.booking || !actionDialog.action) return;
    setActionLoading(true);
    const bookingId = actionDialog.booking.id;
    try {
      switch (actionDialog.action) {
        case 'release':
          await escrowService.release(bookingId);
          addToast('success', 'Escrow released to trainer');
          break;
        case 'refund':
          await escrowService.refund(bookingId);
          addToast('success', 'Escrow refunded to client');
          break;
        case 'freeze':
          await escrowService.freeze(bookingId);
          addToast('success', 'Escrow frozen');
          break;
      }
      setActionDialog({ open: false, booking: null, action: null });
      setDetailModal(false);
      fetchData();
    } catch {
      addToast('error', `Failed to ${actionDialog.action} escrow`);
    } finally {
      setActionLoading(false);
    }
  };

  const actionLabels: Record<EscrowAction, { label: string; variant: 'danger' | 'primary'; desc: string }> = {
    release: { label: 'Release Funds', variant: 'primary', desc: 'Release the held funds to the trainer. This action cannot be undone.' },
    refund: { label: 'Refund Client', variant: 'danger', desc: 'Refund the held funds back to the client. This action cannot be undone.' },
    freeze: { label: 'Freeze Escrow', variant: 'danger', desc: 'Freeze this escrow account pending investigation.' },
  };

  const ic = 'px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50';
  const escrowStatuses = ['PENDING', 'FUNDED', 'RELEASED', 'REFUNDED', 'FROZEN', 'DISPUTED'];

  const cols: Column<BookingWithEscrow>[] = [
    {
      key: 'escrowId', label: 'Escrow ID',
      render: (b) => <span className="text-xs font-mono text-muted-foreground">{(b.escrow?.id || b.escrowId || '-').slice(0, 8)}</span>,
    },
    {
      key: 'client', label: 'Client',
      render: (b) => {
        const c = b.client;
        return c ? <span className="font-medium">{c.firstName} {c.lastName}</span> : '-';
      },
    },
    {
      key: 'trainer', label: 'Trainer',
      render: (b) => {
        const t = b.trainer;
        const u = t?.user || t;
        const firmName = (t as any)?.trainerProfile?.firmName || (t as any)?.firmName;
        const teamOrg = (t as any)?.teamMembership?.organization?.name;
        const orgLabel = firmName || teamOrg;
        return u ? (
          <div>
            <span className="font-medium">{u.firstName} {u.lastName}</span>
            {orgLabel && <p className="text-[10px] text-muted-foreground">{orgLabel}</p>}
          </div>
        ) : '-';
      },
    },
    {
      key: 'amount', label: 'Amount', sortable: true,
      render: (b) => <span className="font-medium">{formatCurrency(Number(b.escrow?.amount || b.amount || 0))}</span>,
    },
    {
      key: 'escrowStatus', label: 'Escrow Status',
      render: (b) => <StatusBadge status={b.escrow?.status || 'UNKNOWN'} />,
    },
    {
      key: 'bookingStatus', label: 'Booking',
      render: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: 'createdAt', label: 'Created',
      render: (b) => <span className="text-muted-foreground text-sm">{formatDate(b.createdAt)}</span>,
    },
    {
      key: 'actions', label: 'Actions',
      render: (b) => {
        const status = b.escrow?.status;
        const canAct = status === 'FUNDED' || status === 'PENDING';
        if (!canAct) return null;
        return (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setActionDialog({ open: true, booking: b, action: 'release' })} className="px-2 py-1 text-xs rounded bg-green-500/10 text-green-600 hover:bg-green-500/20">Release</button>
            <button onClick={() => setActionDialog({ open: true, booking: b, action: 'refund' })} className="px-2 py-1 text-xs rounded bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">Refund</button>
            <button onClick={() => setActionDialog({ open: true, booking: b, action: 'freeze' })} className="px-2 py-1 text-xs rounded bg-purple-500/10 text-purple-600 hover:bg-purple-500/20">Freeze</button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Escrow Accounts"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Escrow' }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatsCard label="Total Escrow Value" value={formatCurrency(totalAmount)} icon={<Icon d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />} />
        <StatsCard label="Pending / Funded" value={pendingCount} icon={<Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />} />
        <StatsCard label="Released" value={releasedCount} icon={<Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />} />
        <StatsCard label="Frozen" value={frozenCount} icon={<Icon d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />} />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={`${ic} w-48`}>
          <option value="">All Statuses</option>
          {escrowStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <DataTable
        columns={cols}
        data={data}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        keyExtractor={(b) => b.escrow?.id || b.escrowId || b.id}
        onRowClick={(b) => { setSelectedBooking(b); setDetailModal(true); }}
        emptyMessage="No escrow accounts found"
      />

      {/* Detail Modal */}
      <Modal isOpen={detailModal} onClose={() => { setDetailModal(false); setSelectedBooking(null); }} title="Escrow Details" size="lg">
        {selectedBooking && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Escrow ID</span>
                <p className="font-mono text-sm mt-1">{selectedBooking.escrow?.id || selectedBooking.escrowId || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Amount</span>
                <p className="font-semibold text-lg mt-1">{formatCurrency(Number(selectedBooking.escrow?.amount || selectedBooking.amount || 0))}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Escrow Status</span>
                <div className="mt-1"><StatusBadge status={selectedBooking.escrow?.status || 'UNKNOWN'} /></div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Booking Status</span>
                <div className="mt-1"><StatusBadge status={selectedBooking.status} /></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Client (Payer)</span>
                <p className="font-medium mt-1">{selectedBooking.client ? `${selectedBooking.client.firstName} ${selectedBooking.client.lastName}` : '-'}</p>
                <p className="text-xs text-muted-foreground">{selectedBooking.client?.email}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Trainer (Payee)</span>
                <p className="font-medium mt-1">{selectedBooking.trainer?.user ? `${selectedBooking.trainer.user.firstName} ${selectedBooking.trainer.user.lastName}` : '-'}</p>
                <p className="text-xs text-muted-foreground">{selectedBooking.trainer?.user?.email}</p>
                {(() => {
                  const t = selectedBooking.trainer as any;
                  const orgLabel = t?.trainerProfile?.firmName || t?.firmName || t?.teamMembership?.organization?.name;
                  return orgLabel ? <p className="text-xs text-muted-foreground mt-0.5 font-medium">{orgLabel}</p> : null;
                })()}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Session Type</span>
                <p className="text-sm mt-1">{selectedBooking.sessionType}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Scheduled</span>
                <p className="text-sm mt-1">{formatDateTime(selectedBooking.scheduledAt)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Created</span>
                <p className="text-sm mt-1">{formatDate(selectedBooking.createdAt)}</p>
              </div>
            </div>

            {selectedBooking.escrow?.releasedAt && (
              <div className="p-3 rounded-lg bg-green-500/10">
                <span className="text-xs text-green-700 dark:text-green-400">Released at: {formatDateTime(selectedBooking.escrow.releasedAt)}</span>
              </div>
            )}
            {selectedBooking.escrow?.refundedAt && (
              <div className="p-3 rounded-lg bg-amber-500/10">
                <span className="text-xs text-amber-700 dark:text-amber-400">Refunded at: {formatDateTime(selectedBooking.escrow.refundedAt)}</span>
              </div>
            )}

            {(selectedBooking.escrow?.status === 'FUNDED' || selectedBooking.escrow?.status === 'PENDING') && (
              <div className="flex gap-3 pt-2 border-t border-border">
                <button onClick={() => setActionDialog({ open: true, booking: selectedBooking, action: 'release' })} className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm hover:bg-green-600">Release Funds</button>
                <button onClick={() => setActionDialog({ open: true, booking: selectedBooking, action: 'refund' })} className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm hover:bg-amber-600">Refund Client</button>
                <button onClick={() => setActionDialog({ open: true, booking: selectedBooking, action: 'freeze' })} className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm hover:bg-purple-600">Freeze</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Action Confirmation */}
      <ConfirmDialog
        isOpen={actionDialog.open}
        onClose={() => setActionDialog({ open: false, booking: null, action: null })}
        onConfirm={handleAction}
        title={actionDialog.action ? actionLabels[actionDialog.action].label : ''}
        message={actionDialog.action ? actionLabels[actionDialog.action].desc : ''}
        confirmLabel={actionDialog.action ? actionLabels[actionDialog.action].label : 'Confirm'}
        confirmVariant={actionDialog.action ? actionLabels[actionDialog.action].variant : 'danger'}
        loading={actionLoading}
      />
    </div>
  );
}
