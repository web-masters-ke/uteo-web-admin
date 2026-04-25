'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { disputeService } from '@/lib/services/disputeService';
import { Dispute } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function DisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState('RELEASE_TO_TRAINER');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDispute = async () => {
    try {
      setDispute(await disputeService.getById(params.id as string));
    } catch {
      addToast('error', 'Failed to load dispute');
      router.push('/dashboard/disputes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDispute(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.id]);

  const handleResolve = async () => {
    if (!dispute) return;
    setActionLoading(true);
    try {
      // Map resolution choice to backend DisputeStatus
      const statusMap: Record<string, string> = {
        RELEASE_TO_TRAINER: 'RESOLVED_RELEASE',
        REFUND_TO_CLIENT: 'RESOLVED_REFUND',
        PARTIAL_REFUND: 'RESOLVED_REFUND',
        NO_ACTION: 'CLOSED',
      };
      const backendStatus = statusMap[resolution] || 'CLOSED';
      await disputeService.resolve(dispute.id, backendStatus, notes);
      addToast('success', 'Dispute resolved');
      setResolveOpen(false);
      fetchDispute();
    } catch {
      addToast('error', 'Failed to resolve dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const ic = "w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50";

  if (loading) return <div className="animate-pulse h-96 bg-card rounded-xl border border-border" />;
  if (!dispute) return null;

  const booking = dispute.booking;
  const canResolve = ['OPEN', 'UNDER_REVIEW'].includes(dispute.status);

  return (
    <div>
      <PageHeader title="Dispute Details" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Disputes', href: '/dashboard/disputes' }, { label: dispute.id.slice(0, 8) }]} actions={
        <div className="flex gap-2">
          {canResolve && <button onClick={() => { setResolution('RELEASE_TO_TRAINER'); setNotes(''); setResolveOpen(true); }} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium">Resolve</button>}
          <button onClick={() => router.push('/dashboard/disputes')} className="px-4 py-2 rounded-lg border border-border bg-card text-sm">Back</button>
        </div>
      } />

      {/* Status Banner */}
      <div className="flex items-center justify-center gap-3 mb-6 p-4 rounded-xl bg-card border border-border">
        <span className="text-sm text-muted-foreground">Status:</span>
        <StatusBadge status={dispute.status} />
        {dispute.resolution && (
          <>
            <span className="text-sm text-muted-foreground ml-4">Resolution:</span>
            <span className="text-sm font-medium">{dispute.resolution.replace(/_/g, ' ')}</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dispute Info */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">Dispute Information</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Dispute ID</dt><dd className="font-mono text-xs">{dispute.id}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd><StatusBadge status={dispute.status} /></dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Booking ID</dt><dd className="font-mono text-xs">{dispute.bookingId}</dd></div>
            {booking && (
              <div className="flex justify-between"><dt className="text-muted-foreground">Booking Amount</dt><dd className="font-medium">{formatCurrency(Number(booking.amount))}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd>{formatDateTime(dispute.createdAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Updated</dt><dd>{formatDateTime(dispute.updatedAt)}</dd></div>
          </dl>
        </div>

        {/* Parties */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">Involved Parties</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Raised By</p>
              <p className="font-medium">{dispute.raisedBy ? `${dispute.raisedBy.firstName} ${dispute.raisedBy.lastName}` : '-'}</p>
              {dispute.raisedBy?.email && <p className="text-xs text-muted-foreground">{dispute.raisedBy.email}</p>}
            </div>
            <div className="p-4 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Against</p>
              <p className="font-medium">{dispute.against ? `${dispute.against.firstName} ${dispute.against.lastName}` : '-'}</p>
              {dispute.against?.email && <p className="text-xs text-muted-foreground">{dispute.against.email}</p>}
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-3">Reason</h3>
          <p className="text-sm">{dispute.reason}</p>
          {dispute.description && dispute.description !== dispute.reason && (
            <div className="mt-3 pt-3 border-t border-border">
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
              <p className="text-sm">{dispute.description}</p>
            </div>
          )}
        </div>

        {/* Resolution Notes */}
        {dispute.resolution && (
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-3">Resolution Notes</h3>
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <p className="text-sm">{dispute.resolution}</p>
            </div>
          </div>
        )}
      </div>

      {/* Resolve Modal */}
      <Modal isOpen={resolveOpen} onClose={() => setResolveOpen(false)} title="Resolve Dispute" size="md">
        <div className="space-y-5">
          {/* Summary */}
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p><span className="text-muted-foreground">Dispute:</span> <span className="font-mono">{dispute.id.slice(0, 8)}</span></p>
            {booking && <p className="mt-1"><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{formatCurrency(Number(booking.amount))}</span></p>}
          </div>

          {/* Resolution radio buttons */}
          <div>
            <label className="block text-sm font-medium mb-3">Resolution*</label>
            <div className="space-y-2">
              {[
                { value: 'RELEASE_TO_TRAINER', label: 'Release to trainer', desc: 'Release the escrowed funds to the trainer' },
                { value: 'REFUND_TO_CLIENT', label: 'Refund to client', desc: 'Refund the escrowed funds back to the client' },
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
            <label className="block text-sm font-medium mb-1">Resolution Notes*</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Explain the resolution decision..." className={ic} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button onClick={() => setResolveOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
            <button onClick={handleResolve} disabled={actionLoading || !notes.trim()} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-white/10">
              {actionLoading ? 'Resolving...' : 'Resolve Dispute'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
