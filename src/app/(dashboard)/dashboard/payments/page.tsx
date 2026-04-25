'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { paymentService, PaymentStats } from '@/lib/services/paymentService';
import { bookingService } from '@/lib/services/bookingService';
import { escrowService } from '@/lib/services/escrowService';
import { walletService } from '@/lib/services/walletService';
import { financialService } from '@/lib/services/financialService';
import { Payment, Booking, Escrow, Transaction } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

/* ================================================================
   Shared small components
   ================================================================ */

const Icon = ({ d }: { d: string }) => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

function ActionButton({
  label,
  color,
  onClick,
  loading,
  disabled,
}: {
  label: string;
  color: 'green' | 'red' | 'amber' | 'blue' | 'purple';
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const colors = {
    green: 'bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20',
    red: 'bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20',
  };
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={loading || disabled}
      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colors[color]}`}
    >
      {loading ? (
        <svg className="w-3 h-3 animate-spin inline" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        label
      )}
    </button>
  );
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        {accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-2xl font-bold text-card-foreground tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

/* ---- Payment type inference from metadata ---- */
function inferPaymentType(p: Payment): string {
  const meta = p.metadata as Record<string, any> | undefined;
  if (meta?.type) return meta.type;
  if (meta?.referenceType) return meta.referenceType;
  if (p.bookingId) return 'Booking';
  if (meta?.courseId) return 'Course';
  if (meta?.subscriptionId) return 'Subscription';
  if (meta?.walletAction === 'deposit' || meta?.description?.toLowerCase?.()?.includes('deposit')) return 'Deposit';
  if (meta?.walletAction === 'withdrawal' || meta?.description?.toLowerCase?.()?.includes('withdraw')) return 'Withdrawal';
  return 'Payment';
}

const paymentTypeColors: Record<string, string> = {
  Booking: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  Course: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  Subscription: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  Deposit: 'bg-green-500/10 text-green-700 dark:text-green-400',
  Withdrawal: 'bg-red-500/10 text-red-700 dark:text-red-400',
  Payment: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
};

const providerColors: Record<string, string> = {
  MPESA: 'bg-green-500/10 text-green-700 dark:text-green-400',
  STRIPE: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  CARD: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  BANK_TRANSFER: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  WALLET: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
};

/* ---- Flow visualization for payment detail modal ---- */
function PaymentFlow({ payment }: { payment: Payment }) {
  const type = inferPaymentType(payment);
  const meta = payment.metadata as Record<string, any> | undefined;
  const userName = payment.user
    ? `${payment.user.firstName} ${payment.user.lastName}`
    : 'Unknown User';

  let target = 'SkillSasa Platform';
  if (type === 'Booking') target = 'Trainer (via Escrow)';
  if (type === 'Course') target = 'Course Provider';
  if (type === 'Subscription') target = 'SkillSasa Subscription';
  if (type === 'Withdrawal') target = `M-Pesa (${meta?.phone || 'phone'})`;
  if (type === 'Deposit') target = 'Wallet Balance';

  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-muted/30 border border-border">
      <div className="text-center min-w-0 flex-1">
        <div className="w-10 h-10 mx-auto rounded-full bg-primary-500/10 flex items-center justify-center mb-1">
          <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <p className="text-xs font-medium text-card-foreground truncate">{userName}</p>
        <p className="text-[10px] text-muted-foreground">{payment.user?.email}</p>
      </div>
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <span className="text-sm font-bold text-card-foreground">{formatCurrency(payment.amount)}</span>
        <div className="flex items-center gap-1">
          <div className="w-8 h-px bg-border" />
          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <div className="w-8 h-px bg-border" />
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${paymentTypeColors[type] || paymentTypeColors.Payment}`}>
          {type}
        </span>
      </div>
      <div className="text-center min-w-0 flex-1">
        <div className="w-10 h-10 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-1">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <p className="text-xs font-medium text-card-foreground truncate">{target}</p>
        <p className="text-[10px] text-muted-foreground">{payment.provider}</p>
      </div>
    </div>
  );
}

/* ================================================================
   Statement Generator
   ================================================================ */
function generateStatement(title: string, rows: { date: string; description: string; type: string; amount: number; status: string }[], summary?: { label: string; value: string }[]) {
  const now = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title} — SkillSasa</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; padding: 40px; max-width: 900px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #192C67; padding-bottom: 20px; }
  .logo { font-size: 24px; font-weight: 900; color: #192C67; }
  .logo small { display: block; font-size: 11px; font-weight: 400; color: #64748b; letter-spacing: 1px; }
  .title { text-align: right; }
  .title h1 { font-size: 22px; color: #192C67; }
  .title .date { font-size: 12px; color: #64748b; margin-top: 4px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .summary-card { padding: 12px 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
  .summary-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
  .summary-card .val { font-size: 18px; font-weight: 800; color: #192C67; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
  th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  td { padding: 10px; border-bottom: 1px solid #f1f5f9; }
  td.amount { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  th.amount { text-align: right; }
  .credit { color: #16a34a; }
  .debit { color: #dc2626; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; }
  .badge-SUCCESS, .badge-PAID, .badge-RELEASED, .badge-COMPLETED { background: #dcfce7; color: #166534; }
  .badge-PENDING, .badge-FUNDED, .badge-REQUESTED, .badge-PROCESSING { background: #fef3c7; color: #92400e; }
  .badge-FAILED, .badge-REJECTED, .badge-FROZEN { background: #fef2f2; color: #991b1b; }
  .badge-REFUNDED { background: #ede9fe; color: #6d28d9; }
  .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
  .total-row td { font-weight: 800; border-top: 2px solid #192C67; font-size: 14px; }
  @media print { body { padding: 20px; } .no-print { display: none !important; } }
</style></head><body>
  <div class="no-print" style="margin-bottom:16px;text-align:right">
    <button onclick="window.print()" style="padding:10px 24px;background:#192C67;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px">Print / Save as PDF</button>
  </div>
  <div class="header">
    <div class="logo">SkillSasa<small>LEARN, GROW, SUCCEED</small></div>
    <div class="title"><h1>${title}</h1><div class="date">Generated: ${now}</div><div class="date">${rows.length} records</div></div>
  </div>
  ${summary ? `<div class="summary">${summary.map(s => `<div class="summary-card"><div class="label">${s.label}</div><div class="val">${s.value}</div></div>`).join('')}</div>` : ''}
  <table>
    <thead><tr><th>Date</th><th>Description</th><th>Type</th><th class="amount">Amount</th><th>Status</th></tr></thead>
    <tbody>
      ${rows.map(r => `<tr>
        <td>${r.date}</td>
        <td>${r.description}</td>
        <td>${r.type}</td>
        <td class="amount ${r.amount >= 0 ? 'credit' : 'debit'}">${r.amount >= 0 ? '+' : ''}KES ${Math.abs(r.amount).toLocaleString()}</td>
        <td><span class="badge badge-${r.status}">${r.status}</span></td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="3">Total (${rows.length} records)</td>
        <td class="amount">KES ${rows.reduce((s, r) => s + r.amount, 0).toLocaleString()}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <p>SkillSasa — Kenya's AI-Powered Trainer Marketplace</p>
    <p>support@skillsasa.co.ke &middot; This is a system-generated statement.</p>
  </div>
</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ================================================================
   Tab type
   ================================================================ */
type TabId = 'payments' | 'escrow' | 'transactions' | 'payouts';

const TABS: { id: TabId; label: string }[] = [
  { id: 'payments', label: 'Payments' },
  { id: 'escrow', label: 'Escrow' },
  { id: 'transactions', label: 'All Transactions' },
  { id: 'payouts', label: 'Payouts' },
];

/* ================================================================
   Escrow helpers
   ================================================================ */
interface BookingWithEscrow extends Booking {
  escrow?: Escrow;
}

type EscrowAction = 'release' | 'refund' | 'freeze';

const escrowActionLabels: Record<EscrowAction, { label: string; variant: 'danger' | 'primary'; desc: string }> = {
  release: { label: 'Release Funds', variant: 'primary', desc: 'Release the held funds to the trainer. This action cannot be undone.' },
  refund: { label: 'Refund Client', variant: 'danger', desc: 'Refund the held funds back to the client. This action cannot be undone.' },
  freeze: { label: 'Freeze Escrow', variant: 'danger', desc: 'Freeze this escrow account pending investigation.' },
};

/* ================================================================
   Transaction type badge colors
   ================================================================ */
const txnTypeColors: Record<string, string> = {
  CREDIT: 'bg-green-500/10 text-green-700 dark:text-green-400',
  DEBIT: 'bg-red-500/10 text-red-700 dark:text-red-400',
  HOLD: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  RELEASE: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  REFUND: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  DEPOSIT: 'bg-green-500/10 text-green-700 dark:text-green-400',
  WITHDRAWAL: 'bg-red-500/10 text-red-700 dark:text-red-400',
  ESCROW_DEBIT: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  ESCROW_CREDIT: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  COMMISSION: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  TRANSFER: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  SUBSCRIPTION: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  COURSE_PURCHASE: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
  PAYOUT: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
};

function isDebitType(type: string): boolean {
  return ['DEBIT', 'HOLD', 'WITHDRAWAL', 'ESCROW_DEBIT', 'COURSE_PURCHASE', 'SUBSCRIPTION', 'PAYOUT'].includes(type);
}

/* ================================================================
   Payout types
   ================================================================ */
interface PayoutItem {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  method: string;
  destination: string;
  status: string;
  reference?: string;
  rejectReason?: string;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string };
  trainer?: { firstName: string; lastName: string; email: string };
}

const PAYOUT_STATUSES = ['', 'REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED'];
const PAYOUT_METHODS = ['', 'MPESA', 'BANK_TRANSFER'];

/* ================================================================
   Main component
   ================================================================ */
export default function PaymentsPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('payments');

  /* ---- Shared input class ---- */
  const ic = 'px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50';

  /* ================================================================
     PAYMENTS TAB STATE
     ================================================================ */
  const [paymentData, setPaymentData] = useState<Payment[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentTotalPages, setPaymentTotalPages] = useState(1);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [providerFilter, setProviderFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState<PaymentStats | null>(null);

  // Detail modal
  const [paymentDetailModal, setPaymentDetailModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Action state
  const [paymentActionLoading, setPaymentActionLoading] = useState<string | null>(null);
  const [paymentConfirmAction, setPaymentConfirmAction] = useState<{
    paymentId: string;
    action: 'process' | 'fail' | 'refund' | 'complete';
    label: string;
    message: string;
  } | null>(null);

  const fetchPayments = useCallback(async () => {
    setPaymentLoading(true);
    try {
      const [d, s] = await Promise.all([
        paymentService.getAll({
          page: paymentPage,
          limit: 10,
          provider: providerFilter,
          status: paymentStatusFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        paymentService.getStats().catch(() => null),
      ]);
      setPaymentData(d.items);
      setPaymentTotalPages(d.totalPages);
      setPaymentTotal(d.total);
      if (s) setStats(s);
    } catch {
      addToast('error', 'Failed to load payments');
    } finally {
      setPaymentLoading(false);
    }
  }, [paymentPage, providerFilter, paymentStatusFilter, startDate, endDate, addToast]);

  const clearPaymentFilters = () => {
    setProviderFilter('');
    setPaymentStatusFilter('');
    setStartDate('');
    setEndDate('');
    setPaymentPage(1);
  };

  const hasPaymentFilters = providerFilter || paymentStatusFilter || startDate || endDate;

  const handlePaymentAction = async (paymentId: string, action: 'process' | 'fail' | 'refund' | 'complete') => {
    setPaymentActionLoading(paymentId);
    try {
      let result: Payment;
      switch (action) {
        case 'process':
          result = await paymentService.processPayment(paymentId);
          addToast('success', 'Payment marked as successful');
          break;
        case 'complete':
          result = await paymentService.completePayment(paymentId);
          addToast('success', 'Payment completed');
          break;
        case 'fail':
          result = await paymentService.failPayment(paymentId);
          addToast('success', 'Payment marked as failed');
          break;
        case 'refund':
          result = await paymentService.refundPayment(paymentId);
          addToast('success', 'Payment refunded');
          break;
      }
      setPaymentData((prev) => prev.map((p) => (p.id === paymentId ? { ...p, status: result.status } : p)));
      if (selectedPayment?.id === paymentId) {
        setSelectedPayment({ ...selectedPayment, status: result.status });
      }
      paymentService.getStats().then((s) => setStats(s)).catch(() => {});
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Action failed';
      addToast('error', msg);
    } finally {
      setPaymentActionLoading(null);
      setPaymentConfirmAction(null);
    }
  };

  const openPaymentConfirm = (paymentId: string, action: 'process' | 'fail' | 'refund' | 'complete') => {
    const labels: Record<string, { label: string; message: string }> = {
      process: { label: 'Mark as Successful', message: 'Are you sure you want to mark this payment as successful? This will confirm the payment was received.' },
      complete: { label: 'Complete Payment', message: 'Are you sure you want to complete this payment?' },
      fail: { label: 'Mark as Failed', message: 'Are you sure you want to mark this payment as failed? The user may need to retry.' },
      refund: { label: 'Refund Payment', message: 'Are you sure you want to refund this payment? The funds will be returned to the user.' },
    };
    setPaymentConfirmAction({ paymentId, action, ...labels[action] });
  };

  const renderPaymentActions = (p: Payment) => {
    const isLoading = paymentActionLoading === p.id;
    switch (p.status) {
      case 'PENDING':
        return (
          <div className="flex items-center gap-1.5">
            <ActionButton label="Process" color="green" loading={isLoading} onClick={() => openPaymentConfirm(p.id, 'process')} />
            <ActionButton label="Fail" color="red" loading={isLoading} onClick={() => openPaymentConfirm(p.id, 'fail')} />
          </div>
        );
      case 'PROCESSING':
        return (
          <div className="flex items-center gap-1.5">
            <ActionButton label="Complete" color="green" loading={isLoading} onClick={() => openPaymentConfirm(p.id, 'complete')} />
            <ActionButton label="Fail" color="red" loading={isLoading} onClick={() => openPaymentConfirm(p.id, 'fail')} />
          </div>
        );
      case 'SUCCESS':
      case 'COMPLETED':
        return (
          <ActionButton label="Refund" color="amber" loading={isLoading} onClick={() => openPaymentConfirm(p.id, 'refund')} />
        );
      default:
        return <span className="text-xs text-muted-foreground">--</span>;
    }
  };

  const paymentCols: Column<Payment>[] = [
    {
      key: 'id',
      label: 'ID',
      render: (p) => <span className="text-xs font-mono text-muted-foreground">{p.id.slice(0, 8)}</span>,
    },
    {
      key: 'user',
      label: 'User',
      render: (p) =>
        p.user ? (
          <div>
            <span className="font-medium">{p.user.firstName} {p.user.lastName}</span>
            <span className="text-xs text-muted-foreground ml-2">{p.user.email}</span>
          </div>
        ) : '-',
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (p) => <span className="font-medium">{formatCurrency(p.amount)}</span>,
    },
    {
      key: 'metadata' as any,
      label: 'Type',
      render: (p) => {
        const type = inferPaymentType(p);
        return (
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${paymentTypeColors[type] || paymentTypeColors.Payment}`}>
            {type}
          </span>
        );
      },
    },
    {
      key: 'provider',
      label: 'Provider',
      render: (p) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${providerColors[p.provider] || 'bg-muted text-muted-foreground'}`}>
          {p.provider}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (p) => <span className="text-muted-foreground text-sm">{formatDateTime(p.createdAt)}</span>,
    },
    {
      key: 'reference',
      label: 'Actions',
      render: (p) => renderPaymentActions(p),
    },
  ];

  /* ================================================================
     ESCROW TAB STATE
     ================================================================ */
  const [escrowData, setEscrowData] = useState<BookingWithEscrow[]>([]);
  const [escrowLoading, setEscrowLoading] = useState(true);
  const [escrowPage, setEscrowPage] = useState(1);
  const [escrowTotalPages, setEscrowTotalPages] = useState(1);
  const [escrowTotal, setEscrowTotal] = useState(0);
  const [escrowStatusFilter, setEscrowStatusFilter] = useState('');

  // Detail modal
  const [escrowDetailModal, setEscrowDetailModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithEscrow | null>(null);

  // Escrow action confirmation
  const [escrowActionDialog, setEscrowActionDialog] = useState<{
    open: boolean;
    booking: BookingWithEscrow | null;
    action: EscrowAction | null;
  }>({ open: false, booking: null, action: null });
  const [escrowActionLoading, setEscrowActionLoading] = useState(false);

  const fetchEscrow = useCallback(async () => {
    setEscrowLoading(true);
    try {
      const d = await bookingService.getAll({ page: escrowPage, limit: 50 });
      const allBookings = d.items as BookingWithEscrow[];
      let withEscrow = allBookings.filter((b) => b.escrow || b.escrowId);
      if (escrowStatusFilter) {
        withEscrow = withEscrow.filter((b) => b.escrow?.status === escrowStatusFilter);
      }
      setEscrowData(withEscrow);
      setEscrowTotalPages(d.totalPages);
      setEscrowTotal(withEscrow.length);
    } catch {
      addToast('error', 'Failed to load escrow accounts');
    } finally {
      setEscrowLoading(false);
    }
  }, [escrowPage, escrowStatusFilter, addToast]);

  const handleEscrowAction = async () => {
    if (!escrowActionDialog.booking || !escrowActionDialog.action) return;
    setEscrowActionLoading(true);
    const bookingId = escrowActionDialog.booking.id;
    try {
      switch (escrowActionDialog.action) {
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
      setEscrowActionDialog({ open: false, booking: null, action: null });
      setEscrowDetailModal(false);
      fetchEscrow();
    } catch {
      addToast('error', `Failed to ${escrowActionDialog.action} escrow`);
    } finally {
      setEscrowActionLoading(false);
    }
  };

  const escrowTotalAmount = escrowData.reduce((sum, b) => sum + Number(b.escrow?.amount || b.amount || 0), 0);
  const escrowPendingCount = escrowData.filter(
    (b) => b.escrow?.status === 'PENDING' || b.escrow?.status === 'FUNDED'
  ).length;
  const escrowReleasedCount = escrowData.filter((b) => b.escrow?.status === 'RELEASED').length;
  const escrowFrozenCount = escrowData.filter((b) => b.escrow?.status === 'FROZEN').length;

  const escrowStatuses = ['PENDING', 'FUNDED', 'RELEASED', 'REFUNDED', 'FROZEN', 'DISPUTED'];

  const renderEscrowActions = (b: BookingWithEscrow) => {
    const status = b.escrow?.status;
    if (status === 'FUNDED' || status === 'PENDING') {
      return (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <ActionButton label="Release" color="green" onClick={() => setEscrowActionDialog({ open: true, booking: b, action: 'release' })} />
          <ActionButton label="Refund" color="amber" onClick={() => setEscrowActionDialog({ open: true, booking: b, action: 'refund' })} />
          <ActionButton label="Freeze" color="purple" onClick={() => setEscrowActionDialog({ open: true, booking: b, action: 'freeze' })} />
        </div>
      );
    }
    if (status === 'FROZEN') {
      return (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <ActionButton label="Release" color="green" onClick={() => setEscrowActionDialog({ open: true, booking: b, action: 'release' })} />
          <ActionButton label="Refund" color="amber" onClick={() => setEscrowActionDialog({ open: true, booking: b, action: 'refund' })} />
        </div>
      );
    }
    return <span className="text-xs text-muted-foreground">--</span>;
  };

  const escrowCols: Column<BookingWithEscrow>[] = [
    {
      key: 'escrowId',
      label: 'Escrow ID',
      render: (b) => <span className="text-xs font-mono text-muted-foreground">{(b.escrow?.id || b.escrowId || '-').slice(0, 8)}</span>,
    },
    {
      key: 'client',
      label: 'Client',
      render: (b) => {
        const c = b.client;
        return c ? <span className="font-medium">{c.firstName} {c.lastName}</span> : '-';
      },
    },
    {
      key: 'trainer',
      label: 'Trainer',
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
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (b) => <span className="font-medium">{formatCurrency(Number(b.escrow?.amount || b.amount || 0))}</span>,
    },
    {
      key: 'escrowStatus',
      label: 'Escrow Status',
      render: (b) => <StatusBadge status={b.escrow?.status || 'UNKNOWN'} />,
    },
    {
      key: 'bookingStatus',
      label: 'Booking',
      render: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (b) => <span className="text-muted-foreground text-sm">{formatDate(b.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (b) => renderEscrowActions(b),
    },
  ];

  /* ================================================================
     ALL TRANSACTIONS TAB STATE
     ================================================================ */
  const [txnData, setTxnData] = useState<Transaction[]>([]);
  const [txnLoading, setTxnLoading] = useState(true);
  const [txnTypeFilter, setTxnTypeFilter] = useState('');

  const fetchTransactions = useCallback(async () => {
    setTxnLoading(true);
    try {
      const txns = await walletService.getTransactions();
      const items = Array.isArray(txns) ? txns : (txns as any)?.items ?? (txns as any)?.data ?? [];
      setTxnData(items);
    } catch {
      addToast('error', 'Failed to load transactions');
    } finally {
      setTxnLoading(false);
    }
  }, [addToast]);

  const filteredTxns = txnTypeFilter
    ? txnData.filter((t) => t.type === txnTypeFilter)
    : txnData;

  const txnTypes = ['CREDIT', 'DEBIT', 'HOLD', 'RELEASE', 'REFUND'];

  const txnCols: Column<Transaction>[] = [
    {
      key: 'type',
      label: 'Type',
      render: (t) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${txnTypeColors[t.type] || 'bg-muted text-muted-foreground'}`}>
          {t.type}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (t) => (
        <span className={`font-medium ${isDebitType(t.type) ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {isDebitType(t.type) ? '-' : '+'}{formatCurrency(t.amount)}
        </span>
      ),
    },
    {
      key: 'user' as any,
      label: 'User',
      render: (t) => t.user ? (
        <span className="font-medium">{t.user.firstName} {t.user.lastName}</span>
      ) : (
        <span className="text-xs text-muted-foreground">{t.userId?.slice(0, 8) || '-'}</span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (t) => (
        <span className="text-sm text-muted-foreground">{t.description || t.reference || '--'}</span>
      ),
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (t) => <span className="text-xs font-mono text-muted-foreground">{t.reference?.slice(0, 12) || '--'}</span>,
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (t) => <span className="text-muted-foreground text-sm">{formatDateTime(t.createdAt)}</span>,
    },
  ];

  /* ================================================================
     PAYOUTS TAB STATE
     ================================================================ */
  const [payoutData, setPayoutData] = useState<PayoutItem[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutTotalPages, setPayoutTotalPages] = useState(1);
  const [payoutTotal, setPayoutTotal] = useState(0);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('');
  const [payoutMethodFilter, setPayoutMethodFilter] = useState('');
  const [payoutStartDate, setPayoutStartDate] = useState('');
  const [payoutEndDate, setPayoutEndDate] = useState('');
  const [payoutStats, setPayoutStats] = useState<any>(null);

  // Payout modals
  const [payoutRejectModal, setPayoutRejectModal] = useState(false);
  const [payoutCompleteModal, setPayoutCompleteModal] = useState(false);
  const [selectedPayoutId, setSelectedPayoutId] = useState('');
  const [payoutRejectReason, setPayoutRejectReason] = useState('');
  const [payoutCompleteRef, setPayoutCompleteRef] = useState('');
  const [payoutActionLoading, setPayoutActionLoading] = useState(false);

  // Payout detail modal
  const [payoutDetailModal, setPayoutDetailModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<PayoutItem | null>(null);

  const fetchPayouts = useCallback(async () => {
    setPayoutLoading(true);
    try {
      const [queue, s] = await Promise.all([
        financialService.payoutQueue({
          page: payoutPage,
          limit: 10,
          status: payoutStatusFilter || undefined,
          method: payoutMethodFilter || undefined,
          startDate: payoutStartDate || undefined,
          endDate: payoutEndDate || undefined,
        }),
        financialService.payoutStats().catch(() => null),
      ]);
      const items = Array.isArray(queue) ? queue : queue?.items || [];
      setPayoutData(items);
      setPayoutTotalPages(queue?.totalPages || 1);
      setPayoutTotal(queue?.total || items.length);
      if (s) setPayoutStats(s);
    } catch {
      addToast('error', 'Failed to load payouts');
    } finally {
      setPayoutLoading(false);
    }
  }, [payoutPage, payoutStatusFilter, payoutMethodFilter, payoutStartDate, payoutEndDate, addToast]);

  const handlePayoutAction = async (action: () => Promise<any>, successMsg: string) => {
    setPayoutActionLoading(true);
    try {
      await action();
      addToast('success', successMsg);
      fetchPayouts();
    } catch (err: any) {
      addToast('error', err?.response?.data?.message || 'Action failed');
    } finally {
      setPayoutActionLoading(false);
    }
  };

  const clearPayoutFilters = () => {
    setPayoutStatusFilter('');
    setPayoutMethodFilter('');
    setPayoutStartDate('');
    setPayoutEndDate('');
    setPayoutPage(1);
  };

  const hasPayoutFilters = payoutStatusFilter || payoutMethodFilter || payoutStartDate || payoutEndDate;
  const payoutPendingCount = payoutStats?.pendingCount || payoutData.filter((p) => p.status === 'REQUESTED').length;

  const payoutCols: Column<PayoutItem>[] = [
    {
      key: 'trainer',
      label: 'Trainer',
      render: (p) => {
        const user = p.user || p.trainer;
        return user ? (
          <div>
            <span className="font-medium">{user.firstName} {user.lastName}</span>
            <span className="text-xs text-muted-foreground ml-2">{user.email}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">--</span>
        );
      },
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (p) => <span className="font-medium">{formatCurrency(Number(p.amount || 0))}</span>,
    },
    {
      key: 'fee',
      label: 'Fee',
      render: (p) => <span className="text-muted-foreground">{formatCurrency(Number(p.fee || 0))}</span>,
    },
    {
      key: 'netAmount',
      label: 'Net',
      render: (p) => <span className="font-medium">{formatCurrency(Number(p.netAmount || p.amount - (p.fee || 0)))}</span>,
    },
    {
      key: 'method',
      label: 'Method',
      render: (p) => {
        const method = p.method || '--';
        const color = method === 'MPESA' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
        return <span className={`text-xs font-medium px-2 py-0.5 rounded ${color}`}>{method}</span>;
      },
    },
    {
      key: 'destination',
      label: 'Destination',
      render: (p) => <span className="text-xs font-mono text-muted-foreground">{p.destination || '--'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (p) => <span className="text-muted-foreground text-sm">{formatDateTime(p.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (p) => (
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          {p.status === 'REQUESTED' && (
            <>
              <button
                onClick={() => handlePayoutAction(() => financialService.approvePayout(p.id), 'Withdrawal approved — now send the money and click Mark Sent')}
                disabled={payoutActionLoading}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => { setSelectedPayoutId(p.id); setPayoutRejectReason(''); setPayoutRejectModal(true); }}
                disabled={payoutActionLoading}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          {p.status === 'APPROVED' && (
            <button
              onClick={() => handlePayoutAction(() => financialService.processPayout(p.id), 'Marked as sending — complete once payment is confirmed')}
              disabled={payoutActionLoading}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
            >
              Send Money
            </button>
          )}
          {p.status === 'PROCESSING' && (
            <button
              onClick={() => { setSelectedPayoutId(p.id); setPayoutCompleteRef(''); setPayoutCompleteModal(true); }}
              disabled={payoutActionLoading}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-400 hover:bg-teal-500/20 disabled:opacity-50"
            >
              Mark Sent
            </button>
          )}
          {p.status === 'COMPLETED' && p.reference && (
            <span className="text-xs text-muted-foreground font-mono">{p.reference}</span>
          )}
          {p.status === 'REJECTED' && p.rejectReason && (
            <span className="text-xs text-red-500 max-w-[120px] truncate" title={p.rejectReason}>{p.rejectReason}</span>
          )}
        </div>
      ),
    },
  ];

  /* ================================================================
     EFFECTS - only fetch when the tab becomes active
     ================================================================ */
  useEffect(() => {
    if (activeTab === 'payments') fetchPayments();
  }, [activeTab, fetchPayments]);

  useEffect(() => {
    if (activeTab === 'escrow') fetchEscrow();
  }, [activeTab, fetchEscrow]);

  useEffect(() => {
    if (activeTab === 'transactions') fetchTransactions();
  }, [activeTab, fetchTransactions]);

  useEffect(() => {
    if (activeTab === 'payouts') fetchPayouts();
  }, [activeTab, fetchPayouts]);

  // Support ?tab=payouts URL param
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && TABS.some((t) => t.id === tab)) {
        setActiveTab(tab as TabId);
      }
    }
  }, []);

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <div>
      <PageHeader
        title="Payments & Escrow"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Payments' }]}
        actions={
          <button
            onClick={() => {
              if (activeTab === 'payments') {
                generateStatement('Payment Statement', payData.map(p => ({
                  date: formatDate(p.createdAt), description: `${inferPaymentType(p)} — ${p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Unknown'}`,
                  type: inferPaymentType(p), amount: Number(p.amount), status: p.status,
                })), [
                  { label: 'Total Payments', value: String(payData.length) },
                  { label: 'Total Volume', value: `KES ${payData.reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}` },
                ]);
              } else if (activeTab === 'escrow') {
                generateStatement('Escrow Statement', escrowData.map(b => ({
                  date: formatDate(b.createdAt), description: `${(b.client as any)?.firstName || ''} ${(b.client as any)?.lastName || ''} → ${(b.trainer as any)?.user?.firstName || (b.trainer as any)?.firstName || ''} ${(b.trainer as any)?.user?.lastName || (b.trainer as any)?.lastName || ''}`,
                  type: 'Escrow', amount: Number(b.escrow?.amount || b.amount || 0), status: b.escrow?.status || 'UNKNOWN',
                })), [
                  { label: 'Total in Escrow', value: `KES ${escrowData.reduce((s, b) => s + Number(b.escrow?.amount || b.amount || 0), 0).toLocaleString()}` },
                  { label: 'Records', value: String(escrowData.length) },
                ]);
              } else if (activeTab === 'transactions') {
                generateStatement('Transaction Statement', txnData.map(t => ({
                  date: formatDate((t as any).createdAt || ''), description: (t as any).description || (t as any).referenceType || 'Transaction',
                  type: (t as any).entryType || (t as any).type || 'TXN', amount: (t as any).entryType === 'DEBIT' ? -Number((t as any).amount || 0) : Number((t as any).amount || 0), status: 'COMPLETED',
                })));
              } else if (activeTab === 'payouts') {
                generateStatement('Payout Statement', payoutData.map(p => ({
                  date: formatDate((p as any).createdAt || ''), description: `${(p as any).user?.firstName || ''} ${(p as any).user?.lastName || ''} — ${(p as any).method || 'M-Pesa'}`,
                  type: 'Payout', amount: -Number((p as any).amount || 0), status: (p as any).status || 'UNKNOWN',
                })), [
                  { label: 'Total Paid Out', value: `KES ${payoutData.reduce((s, p) => s + Number((p as any).amount || 0), 0).toLocaleString()}` },
                  { label: 'Records', value: String(payoutData.length) },
                ]);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download Statement
          </button>
        }
      />

      {/* ---- Tab bar ---- */}
      <div className="flex items-center gap-1 mb-6 p-1 bg-muted rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-[#192C67] text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
            {tab.id === 'payouts' && payoutPendingCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold">
                {payoutPendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ================================================================
         PAYMENTS TAB
         ================================================================ */}
      {activeTab === 'payments' && (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              <MetricCard label="Total Payments" value={formatCurrency(stats.totalAmount)} sub={`${stats.totalPayments} payments`} accent="#192C67" />
              <MetricCard label="Successful" value={formatCurrency(stats.completedAmount)} sub={`${stats.completedCount} payments`} accent="#10B981" />
              <MetricCard label="Pending" value={formatCurrency(stats.pendingAmount)} sub={`${stats.pendingCount} payments`} accent="#F59E0B" />
              <MetricCard label="Processing" value={formatCurrency(stats.processingAmount)} sub={`${stats.processingCount} payments`} accent="#06B6D4" />
              <MetricCard label="Failed" value={formatCurrency(stats.failedAmount)} sub={`${stats.failedCount} payments`} accent="#F43F5E" />
              <MetricCard label="Refunded" value={formatCurrency(stats.refundedAmount)} sub={`${stats.refundedCount} payments`} accent="#7C3AED" />
            </div>
          )}

          {/* Provider breakdown */}
          {stats?.byProvider && stats.byProvider.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">By Provider</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stats.byProvider.map((bp) => (
                  <div key={bp.provider} className="p-4 rounded-xl border border-border bg-card">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${providerColors[bp.provider] || 'bg-muted text-muted-foreground'}`}>
                      {bp.provider}
                    </span>
                    <p className="text-xl font-bold text-card-foreground tabular-nums mt-2">{formatCurrency(bp.amount)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{bp.count} payments</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={providerFilter}
                onChange={(e) => { setProviderFilter(e.target.value); setPaymentPage(1); }}
                className={`${ic} w-44`}
              >
                <option value="">All Providers</option>
                {['MPESA', 'CARD', 'BANK_TRANSFER', 'WALLET'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                value={paymentStatusFilter}
                onChange={(e) => { setPaymentStatusFilter(e.target.value); setPaymentPage(1); }}
                className={`${ic} w-40`}
              >
                <option value="">All Statuses</option>
                {['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPaymentPage(1); }} className={`${ic} w-40`} />
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPaymentPage(1); }} className={`${ic} w-40`} />
              {hasPaymentFilters && (
                <button onClick={clearPaymentFilters} className="px-3 py-2 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-card-foreground">Payment Records</p>
            {paymentTotal > 0 && <p className="text-xs text-muted-foreground">{paymentTotal} total</p>}
          </div>

          <DataTable
            columns={paymentCols}
            data={paymentData}
            loading={paymentLoading}
            page={paymentPage}
            totalPages={paymentTotalPages}
            total={paymentTotal}
            onPageChange={setPaymentPage}
            onRowClick={(p) => { setSelectedPayment(p); setPaymentDetailModal(true); }}
            keyExtractor={(p) => p.id}
            emptyMessage="No payments found"
          />

          {/* Payment Detail Modal */}
          <Modal
            isOpen={paymentDetailModal}
            onClose={() => { setPaymentDetailModal(false); setSelectedPayment(null); }}
            title="Payment Details"
            size="lg"
          >
            {selectedPayment && (
              <div className="space-y-5">
                <PaymentFlow payment={selectedPayment} />

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Payment ID</span>
                    <p className="font-mono text-sm mt-1">{selectedPayment.id}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Amount</span>
                    <p className="font-semibold text-lg mt-1">{formatCurrency(selectedPayment.amount)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Provider</span>
                    <div className="mt-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${providerColors[selectedPayment.provider] || 'bg-muted'}`}>
                        {selectedPayment.provider}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <div className="mt-1"><StatusBadge status={selectedPayment.status} /></div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Type</span>
                    <div className="mt-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${paymentTypeColors[inferPaymentType(selectedPayment)] || paymentTypeColors.Payment}`}>
                        {inferPaymentType(selectedPayment)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">User</span>
                    <p className="font-medium mt-1">
                      {selectedPayment.user ? `${selectedPayment.user.firstName} ${selectedPayment.user.lastName}` : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedPayment.user?.email}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Reference</span>
                    <p className="font-mono text-sm mt-1 break-all">{selectedPayment.reference || '--'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Created</span>
                    <p className="text-sm mt-1">{formatDateTime(selectedPayment.createdAt)}</p>
                  </div>
                  {selectedPayment.bookingId && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <span className="text-xs text-muted-foreground">Booking ID</span>
                      <p className="font-mono text-sm mt-1">{selectedPayment.bookingId}</p>
                    </div>
                  )}
                </div>

                {selectedPayment.metadata && Object.keys(selectedPayment.metadata).length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Metadata</span>
                    <pre className="text-xs mt-2 overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedPayment.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Modal action buttons */}
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  {selectedPayment.status === 'PENDING' && (
                    <>
                      <ActionButton label="Process Payment" color="green" loading={paymentActionLoading === selectedPayment.id} onClick={() => openPaymentConfirm(selectedPayment.id, 'process')} />
                      <ActionButton label="Mark Failed" color="red" loading={paymentActionLoading === selectedPayment.id} onClick={() => openPaymentConfirm(selectedPayment.id, 'fail')} />
                    </>
                  )}
                  {selectedPayment.status === 'PROCESSING' && (
                    <>
                      <ActionButton label="Complete" color="green" loading={paymentActionLoading === selectedPayment.id} onClick={() => openPaymentConfirm(selectedPayment.id, 'complete')} />
                      <ActionButton label="Mark Failed" color="red" loading={paymentActionLoading === selectedPayment.id} onClick={() => openPaymentConfirm(selectedPayment.id, 'fail')} />
                    </>
                  )}
                  {(selectedPayment.status === 'SUCCESS' || selectedPayment.status === 'COMPLETED') && (
                    <ActionButton label="Refund Payment" color="amber" loading={paymentActionLoading === selectedPayment.id} onClick={() => openPaymentConfirm(selectedPayment.id, 'refund')} />
                  )}
                  {(selectedPayment.status === 'FAILED' || selectedPayment.status === 'REFUNDED') && (
                    <span className="text-xs text-muted-foreground italic">No actions available for {selectedPayment.status.toLowerCase()} payments</span>
                  )}
                </div>
              </div>
            )}
          </Modal>

          {/* Payment confirmation dialog (inline version for payment tab) */}
          {paymentConfirmAction && (
            <Modal
              isOpen={!!paymentConfirmAction}
              onClose={() => setPaymentConfirmAction(null)}
              title={paymentConfirmAction.label}
              size="sm"
            >
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{paymentConfirmAction.message}</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setPaymentConfirmAction(null)}
                    disabled={!!paymentActionLoading}
                    className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted text-card-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handlePaymentAction(paymentConfirmAction.paymentId, paymentConfirmAction.action)}
                    disabled={!!paymentActionLoading}
                    className={`px-4 py-2 text-sm rounded-lg font-medium text-white disabled:opacity-50 ${
                      paymentConfirmAction.action === 'fail'
                        ? 'bg-red-600 hover:bg-red-700'
                        : paymentConfirmAction.action === 'refund'
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {paymentActionLoading ? 'Processing...' : paymentConfirmAction.label}
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </>
      )}

      {/* ================================================================
         ESCROW TAB
         ================================================================ */}
      {activeTab === 'escrow' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total in Escrow" value={formatCurrency(escrowTotalAmount)} accent="#192C67" />
            <MetricCard label="Funded / Held" value={escrowPendingCount} accent="#F59E0B" />
            <MetricCard label="Released" value={escrowReleasedCount} accent="#10B981" />
            <MetricCard label="Frozen" value={escrowFrozenCount} accent="#F43F5E" />
          </div>

          {/* Filter + section header */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={escrowStatusFilter}
                onChange={(e) => { setEscrowStatusFilter(e.target.value); setEscrowPage(1); }}
                className={`${ic} w-48`}
              >
                <option value="">All Statuses</option>
                {escrowStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {escrowStatusFilter && (
                <button onClick={() => { setEscrowStatusFilter(''); setEscrowPage(1); }} className="px-3 py-2 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                  Clear filter
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-card-foreground">Escrow Accounts</p>
            {escrowTotal > 0 && <p className="text-xs text-muted-foreground">{escrowTotal} total</p>}
          </div>

          <DataTable
            columns={escrowCols}
            data={escrowData}
            loading={escrowLoading}
            page={escrowPage}
            totalPages={escrowTotalPages}
            total={escrowTotal}
            onPageChange={setEscrowPage}
            keyExtractor={(b) => b.escrow?.id || b.escrowId || b.id}
            onRowClick={(b) => { setSelectedBooking(b); setEscrowDetailModal(true); }}
            emptyMessage="No escrow accounts found"
          />

          {/* Escrow Detail Modal */}
          <Modal
            isOpen={escrowDetailModal}
            onClose={() => { setEscrowDetailModal(false); setSelectedBooking(null); }}
            title="Escrow Details"
            size="lg"
          >
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

                {/* Escrow modal action buttons */}
                {(selectedBooking.escrow?.status === 'FUNDED' || selectedBooking.escrow?.status === 'PENDING') && (
                  <div className="flex gap-3 pt-2 border-t border-border">
                    <ActionButton label="Release Funds" color="green" onClick={() => setEscrowActionDialog({ open: true, booking: selectedBooking, action: 'release' })} />
                    <ActionButton label="Refund Client" color="amber" onClick={() => setEscrowActionDialog({ open: true, booking: selectedBooking, action: 'refund' })} />
                    <ActionButton label="Freeze" color="purple" onClick={() => setEscrowActionDialog({ open: true, booking: selectedBooking, action: 'freeze' })} />
                  </div>
                )}
                {selectedBooking.escrow?.status === 'FROZEN' && (
                  <div className="flex gap-3 pt-2 border-t border-border">
                    <ActionButton label="Release Funds" color="green" onClick={() => setEscrowActionDialog({ open: true, booking: selectedBooking, action: 'release' })} />
                    <ActionButton label="Refund Client" color="amber" onClick={() => setEscrowActionDialog({ open: true, booking: selectedBooking, action: 'refund' })} />
                  </div>
                )}
                {(selectedBooking.escrow?.status === 'RELEASED' || selectedBooking.escrow?.status === 'REFUNDED') && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground italic">No actions available -- escrow is {selectedBooking.escrow?.status?.toLowerCase()}</span>
                  </div>
                )}
              </div>
            )}
          </Modal>

          {/* Escrow Action Confirmation */}
          <ConfirmDialog
            isOpen={escrowActionDialog.open}
            onClose={() => setEscrowActionDialog({ open: false, booking: null, action: null })}
            onConfirm={handleEscrowAction}
            title={escrowActionDialog.action ? escrowActionLabels[escrowActionDialog.action].label : ''}
            message={escrowActionDialog.action ? escrowActionLabels[escrowActionDialog.action].desc : ''}
            confirmLabel={escrowActionDialog.action ? escrowActionLabels[escrowActionDialog.action].label : 'Confirm'}
            confirmVariant={escrowActionDialog.action ? escrowActionLabels[escrowActionDialog.action].variant : 'danger'}
            loading={escrowActionLoading}
          />
        </>
      )}

      {/* ================================================================
         ALL TRANSACTIONS TAB
         ================================================================ */}
      {activeTab === 'transactions' && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Transactions" value={txnData.length} />
            <MetricCard
              label="Total Credits"
              value={formatCurrency(txnData.filter((t) => !isDebitType(t.type)).reduce((s, t) => s + t.amount, 0))}
              sub={`${txnData.filter((t) => !isDebitType(t.type)).length} entries`}
              accent="#10B981"
            />
            <MetricCard
              label="Total Debits"
              value={formatCurrency(txnData.filter((t) => isDebitType(t.type)).reduce((s, t) => s + t.amount, 0))}
              sub={`${txnData.filter((t) => isDebitType(t.type)).length} entries`}
              accent="#F43F5E"
            />
            <MetricCard
              label="Holds / Releases"
              value={txnData.filter((t) => t.type === 'HOLD' || t.type === 'RELEASE').length}
              accent="#F59E0B"
            />
          </div>

          {/* Type filter */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={txnTypeFilter}
                onChange={(e) => setTxnTypeFilter(e.target.value)}
                className={`${ic} w-48`}
              >
                <option value="">All Types</option>
                {txnTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {txnTypeFilter && (
                <button onClick={() => setTxnTypeFilter('')} className="px-3 py-2 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                  Clear filter
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-card-foreground">Ledger Entries</p>
            {filteredTxns.length > 0 && <p className="text-xs text-muted-foreground">{filteredTxns.length} entries</p>}
          </div>

          <DataTable
            columns={txnCols}
            data={filteredTxns}
            loading={txnLoading}
            page={1}
            totalPages={1}
            total={filteredTxns.length}
            onPageChange={() => {}}
            keyExtractor={(t) => t.id}
            emptyMessage="No transactions found"
          />
        </>
      )}

      {/* ================================================================
         PAYOUTS TAB
         ================================================================ */}
      {activeTab === 'payouts' && (
        <>
          {/* Stats */}
          {payoutStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard label="Total Paid" value={formatCurrency(Number(payoutStats.totalPaid || payoutStats.completedAmount || 0))} accent="#10B981" />
              <MetricCard label="Pending Amount" value={formatCurrency(Number(payoutStats.pendingAmount || 0))} accent="#F59E0B" />
              <MetricCard label="This Month" value={formatCurrency(Number(payoutStats.thisMonth || payoutStats.monthAmount || 0))} accent="#06B6D4" />
              <MetricCard label="Avg Processing Time" value={payoutStats.avgProcessingTime ? `${payoutStats.avgProcessingTime}h` : '--'} />
            </div>
          )}

          {/* Filters */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <select value={payoutStatusFilter} onChange={(e) => { setPayoutStatusFilter(e.target.value); setPayoutPage(1); }} className={`${ic} w-44`}>
                <option value="">All Statuses</option>
                {PAYOUT_STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={payoutMethodFilter} onChange={(e) => { setPayoutMethodFilter(e.target.value); setPayoutPage(1); }} className={`${ic} w-44`}>
                <option value="">All Methods</option>
                {PAYOUT_METHODS.filter(Boolean).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="date" value={payoutStartDate} onChange={(e) => { setPayoutStartDate(e.target.value); setPayoutPage(1); }} className={`${ic} w-40`} />
              <input type="date" value={payoutEndDate} onChange={(e) => { setPayoutEndDate(e.target.value); setPayoutPage(1); }} className={`${ic} w-40`} />
              {hasPayoutFilters && (
                <button onClick={clearPayoutFilters} className="px-3 py-2 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-card-foreground">Payout Queue</p>
            {payoutTotal > 0 && <p className="text-xs text-muted-foreground">{payoutTotal} total{payoutPendingCount > 0 ? ` · ${payoutPendingCount} pending` : ''}</p>}
          </div>

          <DataTable
            columns={payoutCols}
            data={payoutData}
            loading={payoutLoading}
            page={payoutPage}
            totalPages={payoutTotalPages}
            total={payoutTotal}
            onPageChange={setPayoutPage}
            onRowClick={(p) => { setSelectedPayout(p); setPayoutDetailModal(true); }}
            keyExtractor={(p) => p.id}
            emptyMessage="No payouts found"
          />

          {/* Payout Reject Modal */}
          <Modal isOpen={payoutRejectModal} onClose={() => setPayoutRejectModal(false)} title="Reject Payout" size="sm">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Provide a reason for rejecting this payout request.</p>
              <textarea
                value={payoutRejectReason}
                onChange={(e) => setPayoutRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setPayoutRejectModal(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!payoutRejectReason.trim()) { addToast('warning', 'Please provide a reason'); return; }
                    await handlePayoutAction(() => financialService.rejectPayout(selectedPayoutId, payoutRejectReason), 'Payout rejected');
                    setPayoutRejectModal(false);
                  }}
                  disabled={payoutActionLoading}
                  className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {payoutActionLoading ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </Modal>

          {/* Payout Complete Modal */}
          <Modal isOpen={payoutCompleteModal} onClose={() => setPayoutCompleteModal(false)} title="Complete Payout" size="sm">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter the M-Pesa or bank transaction reference number.</p>
              <input
                value={payoutCompleteRef}
                onChange={(e) => setPayoutCompleteRef(e.target.value)}
                placeholder="e.g. SHK4F5G6H7..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setPayoutCompleteModal(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!payoutCompleteRef.trim()) { addToast('warning', 'Please enter a reference'); return; }
                    await handlePayoutAction(() => financialService.completePayout(selectedPayoutId, payoutCompleteRef), 'Payout completed');
                    setPayoutCompleteModal(false);
                  }}
                  disabled={payoutActionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#192C67] hover:bg-[#0f1e47] text-white disabled:opacity-50"
                >
                  {payoutActionLoading ? 'Completing...' : 'Mark Complete'}
                </button>
              </div>
            </div>
          </Modal>

          {/* Payout Detail Modal */}
          <Modal isOpen={payoutDetailModal} onClose={() => { setPayoutDetailModal(false); setSelectedPayout(null); }} title="Payout Details" size="md">
            {selectedPayout && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Payout ID</span>
                    <p className="font-mono text-sm mt-1">{selectedPayout.id}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Amount</span>
                    <p className="font-semibold text-lg mt-1">{formatCurrency(Number(selectedPayout.amount || 0))}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Fee</span>
                    <p className="font-medium mt-1">{formatCurrency(Number(selectedPayout.fee || 0))}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Net Amount</span>
                    <p className="font-medium mt-1">{formatCurrency(Number(selectedPayout.netAmount || selectedPayout.amount - (selectedPayout.fee || 0)))}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Method</span>
                    <p className="mt-1">{selectedPayout.method || '--'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Destination</span>
                    <p className="font-mono text-sm mt-1">{selectedPayout.destination || '--'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <div className="mt-1"><StatusBadge status={selectedPayout.status} /></div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Date</span>
                    <p className="text-sm mt-1">{formatDateTime(selectedPayout.createdAt)}</p>
                  </div>
                </div>
                {selectedPayout.reference && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Reference</span>
                    <p className="font-mono text-sm mt-1">{selectedPayout.reference}</p>
                  </div>
                )}
                {selectedPayout.rejectReason && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <span className="text-xs text-red-600 dark:text-red-400">Rejection Reason</span>
                    <p className="text-sm mt-1 text-red-700 dark:text-red-300">{selectedPayout.rejectReason}</p>
                  </div>
                )}
              </div>
            )}
          </Modal>
        </>
      )}
    </div>
  );
}
