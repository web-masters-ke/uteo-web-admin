'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { bookingService } from '@/lib/services/bookingService';
import { escrowService } from '@/lib/services/escrowService';
import { Booking, Escrow } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Status change
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');

  const fetchBooking = async () => {
    try {
      const data = await bookingService.getById(params.id as string);
      setBooking(data);
      // Try to load escrow data
      if (data.escrowId) {
        try {
          const e = await escrowService.getByBooking(data.id);
          setEscrow(e);
        } catch { /* no escrow */ }
      }
    } catch {
      addToast('error', 'Failed to load booking');
      router.push('/dashboard/bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBooking(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.id]);

  const handleStatusChange = async () => {
    if (!booking || !newStatus) return;
    setActionLoading(true);
    try {
      switch (newStatus) {
        case 'CONFIRMED': await bookingService.confirm(booking.id); break;
        case 'COMPLETED': await bookingService.complete(booking.id); break;
        case 'CANCELLED': await bookingService.cancel(booking.id, statusReason); break;
        case 'DISPUTED': await bookingService.dispute(booking.id, statusReason); break;
      }
      addToast('success', `Status changed to ${newStatus}`);
      setStatusModal(false);
      setNewStatus('');
      setStatusReason('');
      fetchBooking();
    } catch {
      addToast('error', 'Failed to change status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscrowAction = async (action: 'release' | 'refund' | 'freeze') => {
    if (!booking) return;
    setActionLoading(true);
    try {
      if (action === 'release') await escrowService.release(booking.id);
      else if (action === 'refund') await escrowService.refund(booking.id);
      else await escrowService.freeze(booking.id);
      addToast('success', `Escrow ${action}d`);
      fetchBooking();
    } catch {
      addToast('error', `Failed to ${action} escrow`);
    } finally {
      setActionLoading(false);
    }
  };

  const ic = "w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50";

  if (loading) return <div className="animate-pulse h-96 bg-card rounded-xl border border-border" />;
  if (!booking) return null;

  const client = booking.client as any;
  const trainer = booking.trainer as any;

  return (
    <div>
      <PageHeader title="Booking Details" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Bookings', href: '/dashboard/bookings' }, { label: booking.id.slice(0, 8) }]} actions={
        <div className="flex gap-2">
          <button onClick={() => { setNewStatus(''); setStatusReason(''); setStatusModal(true); }} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm">Change Status</button>
          <button onClick={() => router.push('/dashboard/bookings')} className="px-4 py-2 rounded-lg border border-border bg-card text-sm">Back</button>
        </div>
      } />

      {/* Status Banner */}
      <div className="flex items-center justify-center gap-3 mb-6 p-4 rounded-xl bg-card border border-border">
        <span className="text-sm text-muted-foreground">Status:</span>
        <StatusBadge status={booking.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Details */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">Booking Details</h3>
          <dl className="space-y-3 text-sm">
            {[
              ['Booking ID', booking.id],
              ['Scheduled', formatDateTime(booking.scheduledAt)],
              ['Duration', `${booking.duration} minutes`],
              ['Amount', formatCurrency(booking.amount)],
              ['Session Type', (booking.sessionType || '').replace(/_/g, ' ')],
              ['Location', booking.location || '-'],
              ['Created', formatDateTime(booking.createdAt)],
              ['Updated', formatDateTime(booking.updatedAt)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium text-right">{v}</dd>
              </div>
            ))}
          </dl>
          {booking.notes && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{booking.notes}</p>
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">Participants</h3>
            <div className="space-y-4">
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Client</p>
                <p className="text-sm font-medium">{client?.firstName} {client?.lastName}</p>
                <p className="text-xs text-muted-foreground">{client?.email}</p>
              </div>
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Trainer</p>
                <p className="text-sm font-medium">{trainer?.user?.firstName || trainer?.firstName} {trainer?.user?.lastName || trainer?.lastName}</p>
                <p className="text-xs text-muted-foreground">{trainer?.user?.email || trainer?.email}</p>
              </div>
            </div>
          </div>

          {/* Escrow Info */}
          {(escrow || (booking as any).escrow) && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4">Escrow</h3>
              {(() => {
                const esc = escrow || (booking as any).escrow;
                return (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <StatusBadge status={esc.status} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">{formatCurrency(Number(esc.amount))}</span>
                    </div>
                    {esc.releasedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Released</span>
                        <span>{formatDateTime(esc.releasedAt)}</span>
                      </div>
                    )}
                    {esc.refundedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Refunded</span>
                        <span>{formatDateTime(esc.refundedAt)}</span>
                      </div>
                    )}
                    {esc.status === 'FUNDED' && (
                      <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                        <button onClick={() => handleEscrowAction('release')} disabled={actionLoading} className="flex-1 px-3 py-2 rounded-lg bg-green-500 text-white text-xs disabled:opacity-50">Release</button>
                        <button onClick={() => handleEscrowAction('refund')} disabled={actionLoading} className="flex-1 px-3 py-2 rounded-lg bg-amber-500 text-white text-xs disabled:opacity-50">Refund</button>
                        <button onClick={() => handleEscrowAction('freeze')} disabled={actionLoading} className="flex-1 px-3 py-2 rounded-lg bg-purple-500 text-white text-xs disabled:opacity-50">Freeze</button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Status Change Modal */}
      <Modal isOpen={statusModal} onClose={() => setStatusModal(false)} title="Change Booking Status" size="sm">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p><span className="text-muted-foreground">Current:</span> <StatusBadge status={booking.status} /></p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Status*</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className={ic}>
              <option value="">Select...</option>
              {['CONFIRMED', 'COMPLETED', 'CANCELLED', 'DISPUTED'].filter(s => s !== booking.status).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {(newStatus === 'CANCELLED' || newStatus === 'DISPUTED') && (
            <div>
              <label className="block text-sm font-medium mb-1">Reason*</label>
              <textarea value={statusReason} onChange={e => setStatusReason(e.target.value)} rows={3} placeholder="Provide a reason..." className={ic} />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={() => setStatusModal(false)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancel</button>
            <button onClick={handleStatusChange} disabled={actionLoading || !newStatus || ((newStatus === 'CANCELLED' || newStatus === 'DISPUTED') && !statusReason)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm disabled:opacity-50">
              {actionLoading ? 'Updating...' : 'Update'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
