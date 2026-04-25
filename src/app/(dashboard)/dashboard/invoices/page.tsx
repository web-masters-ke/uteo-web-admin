'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { financialService } from '@/lib/services/financialService';
import { bookingService } from '@/lib/services/bookingService';
import { userService } from '@/lib/services/userService';
import { User, Booking } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils';

/* ─── Types ─── */

const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID'] as const;

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  issuer?: { firstName: string; lastName: string; email: string };
  recipient?: { firstName: string; lastName: string; email: string };
  recipientId?: string;
  amount: number;
  tax: number;
  total: number;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  issuedAt?: string;
  sentAt?: string;
  paidAt?: string;
  voidedAt?: string;
  dueDate?: string;
  lineItems?: LineItem[];
  items?: { description: string; amount: number; quantity: number; unitPrice?: number }[];
  notes?: string;
  bookingId?: string;
}

interface InvoiceStats {
  totalCount: number;
  totalAmount: number;
  paidAmount: number;
  paidCount: number;
  outstandingAmount: number;
  outstandingCount: number;
  overdueCount: number;
  draftCount: number;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  VOID: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

const emptyLineItem = (): LineItem => ({ description: '', quantity: 1, unitPrice: 0, total: 0 });

/* ─── Receipt Generator ─── */
function downloadReceipt(inv: InvoiceItem) {
  const lineItems = (() => {
    try {
      const li = typeof inv.lineItems === 'string' ? JSON.parse(inv.lineItems) : inv.lineItems;
      return Array.isArray(li) ? li : [];
    } catch { return []; }
  })();

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${inv.invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #F77B0F; padding-bottom: 20px; }
  .logo { font-size: 24px; font-weight: 900; color: #F77B0F; }
  .logo small { display: block; font-size: 11px; font-weight: 400; color: #64748b; letter-spacing: 1px; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { font-size: 28px; color: #F77B0F; text-transform: uppercase; letter-spacing: 2px; }
  .invoice-title .number { font-size: 14px; color: #64748b; margin-top: 4px; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .status-PAID { background: #dcfce7; color: #166534; }
  .status-SENT { background: #dbeafe; color: #1e40af; }
  .status-DRAFT { background: #f1f5f9; color: #475569; }
  .status-OVERDUE { background: #fef2f2; color: #991b1b; }
  .status-VOID { background: #f1f5f9; color: #94a3b8; text-decoration: line-through; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
  .party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
  .party p { font-size: 14px; margin-bottom: 2px; }
  .party .name { font-weight: 700; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f8fafc; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
  td.amount { text-align: right; font-variant-numeric: tabular-nums; }
  th.amount { text-align: right; }
  .totals { display: flex; justify-content: flex-end; }
  .totals table { width: 280px; }
  .totals td { border: none; padding: 6px 12px; }
  .totals .grand { font-size: 18px; font-weight: 900; color: #F77B0F; border-top: 2px solid #F77B0F; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; }
  @media print { body { padding: 20px; } .no-print { display: none; } }
</style></head><body>
  <div class="no-print" style="margin-bottom:20px;text-align:right">
    <button onclick="window.print()" style="padding:10px 24px;background:#F77B0F;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px">Print / Save as PDF</button>
  </div>
  <div class="header">
    <div class="logo">Uteo<small>Skills Today. Opportunities Tomorrow.</small></div>
    <div class="invoice-title">
      <h1>Invoice</h1>
      <div class="number">${inv.invoiceNumber}</div>
      <div style="margin-top:8px"><span class="status status-${inv.status}">${inv.status}</span></div>
    </div>
  </div>
  <div class="parties">
    <div class="party">
      <h3>From</h3>
      <p class="name">${inv.issuer?.firstName || ''} ${inv.issuer?.lastName || ''}</p>
      <p>${inv.issuer?.email || ''}</p>
    </div>
    <div class="party">
      <h3>To</h3>
      <p class="name">${inv.recipient?.firstName || ''} ${inv.recipient?.lastName || ''}</p>
      <p>${inv.recipient?.email || ''}</p>
    </div>
  </div>
  <div class="parties">
    <div class="party"><h3>Issue Date</h3><p>${inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' }) : new Date(inv.createdAt).toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' })}</p></div>
    <div class="party"><h3>Due Date</h3><p style="color:${inv.status === 'OVERDUE' ? '#dc2626' : '#1e293b'}">${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' }) : 'On receipt'}</p></div>
  </div>
  ${inv.description ? `<p style="margin-bottom:20px;color:#475569;font-size:14px">${inv.description}</p>` : ''}
  <table>
    <thead><tr><th>Description</th><th class="amount">Qty</th><th class="amount">Unit Price</th><th class="amount">Total</th></tr></thead>
    <tbody>
      ${lineItems.length > 0 ? lineItems.map((li: any) => `<tr><td>${li.description || ''}</td><td class="amount">${li.qty || li.quantity || 1}</td><td class="amount">KES ${Number(li.unitPrice || 0).toLocaleString()}</td><td class="amount">KES ${Number(li.total || 0).toLocaleString()}</td></tr>`).join('') : `<tr><td>${inv.description || 'Services rendered'}</td><td class="amount">1</td><td class="amount">KES ${Number(inv.amount).toLocaleString()}</td><td class="amount">KES ${Number(inv.amount).toLocaleString()}</td></tr>`}
    </tbody>
  </table>
  <div class="totals"><table>
    <tr><td>Subtotal</td><td class="amount">KES ${Number(inv.amount).toLocaleString()}</td></tr>
    <tr><td>Tax</td><td class="amount">KES ${Number(inv.tax || 0).toLocaleString()}</td></tr>
    <tr><td class="grand">Total</td><td class="amount grand">KES ${Number(inv.total).toLocaleString()}</td></tr>
    ${inv.status === 'PAID' ? `<tr><td style="color:#166534;font-weight:700">Paid</td><td class="amount" style="color:#166534;font-weight:700">${inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('en-KE') : 'Yes'}</td></tr>` : ''}
  </table></div>
  <div class="footer">
    <p>Uteo — Recruitment Intelligence Platform</p>
    <p>support@uteo.com &middot; www.uteo.com</p>
  </div>
</body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ─── Page ─── */

export default function InvoicesPage() {
  const { addToast } = useToast();

  /* ─ List state ─ */
  const [data, setData] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  /* ─ Stats ─ */
  const [stats, setStats] = useState<InvoiceStats>({
    totalCount: 0, totalAmount: 0, paidAmount: 0, paidCount: 0,
    outstandingAmount: 0, outstandingCount: 0, overdueCount: 0, draftCount: 0,
  });

  /* ─ Modals ─ */
  const [detailModal, setDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [bookingModal, setBookingModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  /* ─ Confirm dialogs ─ */
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string;
    label: string; variant: 'danger' | 'primary';
    action: () => Promise<void>;
  }>({ open: false, title: '', message: '', label: '', variant: 'primary', action: async () => {} });

  /* ─ Create/Edit form ─ */
  const [formRecipientId, setFormRecipientId] = useState('');
  const [formRecipientName, setFormRecipientName] = useState('');
  const [formRecipientSearch, setFormRecipientSearch] = useState('');
  const [recipientResults, setRecipientResults] = useState<User[]>([]);
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [recipientFocused, setRecipientFocused] = useState(false);
  const [formDescription, setFormDescription] = useState('');
  const [formLineItems, setFormLineItems] = useState<LineItem[]>([emptyLineItem()]);
  const [formTaxEnabled, setFormTaxEnabled] = useState(true);
  const [formTaxRate, setFormTaxRate] = useState(16);
  const [formDueDate, setFormDueDate] = useState('');
  const [editingInvoiceId, setEditingInvoiceId] = useState('');

  /* ─ Booking search (auto-generate) ─ */
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingResults, setBookingResults] = useState<Booking[]>([]);
  const [searchingBookings, setSearchingBookings] = useState(false);

  const ic = 'px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50';
  const icFull = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors';

  /* ─── Fetch ─── */

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financialService.allInvoices({
        page, limit: 10,
        status: statusFilter || undefined,
        search: search || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const items = Array.isArray(res) ? res : res?.items || [];
      setData(items);
      setTotalPages(res?.totalPages || 1);
      setTotal(res?.total || items.length);
    } catch {
      addToast('error', 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, startDate, endDate, addToast]);

  const fetchStats = useCallback(async () => {
    try {
      const s = await financialService.invoiceStats();
      setStats({
        totalCount: s.totalCount || s.total || 0,
        totalAmount: Number(s.totalAmount || 0),
        paidAmount: Number(s.paidAmount || 0),
        paidCount: s.paidCount || 0,
        outstandingAmount: Number(s.outstandingAmount || 0),
        outstandingCount: s.outstandingCount || 0,
        overdueCount: s.overdueCount || 0,
        draftCount: s.draftCount || 0,
      });
    } catch { /* stats failure is non-critical */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* ─── Recipient search (debounced) ─── */

  useEffect(() => {
    if (!recipientFocused || formRecipientId) return;
    const t = setTimeout(async () => {
      setSearchingRecipients(true);
      try {
        const params: Record<string, any> = { limit: 10 };
        if (formRecipientSearch.length >= 1) params.search = formRecipientSearch;
        const result = await userService.getAll(params);
        setRecipientResults(result.items || []);
      } catch { setRecipientResults([]); }
      finally { setSearchingRecipients(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [formRecipientSearch, recipientFocused, formRecipientId]);

  /* ─── Booking search ─── */

  const searchBookings = useCallback(async (query: string) => {
    setSearchingBookings(true);
    try {
      const result = await bookingService.getAll({
        limit: 10,
        status: 'COMPLETED',
        search: query || undefined,
      });
      setBookingResults(result.items || []);
    } catch { setBookingResults([]); }
    finally { setSearchingBookings(false); }
  }, []);

  const bookingSearchTimer = useRef<NodeJS.Timeout>();
  useEffect(() => {
    if (!bookingModal) return;
    clearTimeout(bookingSearchTimer.current);
    bookingSearchTimer.current = setTimeout(() => searchBookings(bookingSearch), 300);
    return () => clearTimeout(bookingSearchTimer.current);
  }, [bookingSearch, bookingModal, searchBookings]);

  /* ─── Line items calc ─── */

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setFormLineItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'description') item.description = value as string;
      else if (field === 'quantity') item.quantity = Math.max(0, Number(value));
      else if (field === 'unitPrice') item.unitPrice = Math.max(0, Number(value));
      item.total = item.quantity * item.unitPrice;
      updated[index] = item;
      return updated;
    });
  };

  const addLineItem = () => setFormLineItems(prev => [...prev, emptyLineItem()]);
  const removeLineItem = (index: number) => {
    setFormLineItems(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index));
  };

  const subtotal = formLineItems.reduce((sum, li) => sum + li.total, 0);
  const taxAmount = formTaxEnabled ? subtotal * (formTaxRate / 100) : 0;
  const grandTotal = subtotal + taxAmount;

  /* ─── Form reset ─── */

  const resetForm = () => {
    setFormRecipientId('');
    setFormRecipientName('');
    setFormRecipientSearch('');
    setRecipientResults([]);
    setFormDescription('');
    setFormLineItems([emptyLineItem()]);
    setFormTaxEnabled(true);
    setFormTaxRate(16);
    setFormDueDate('');
    setEditingInvoiceId('');
  };

  /* ─── Populate form for edit ─── */

  const populateFormForEdit = (inv: InvoiceItem) => {
    setFormRecipientId(inv.recipientId || '');
    setFormRecipientName(inv.recipient ? `${inv.recipient.firstName} ${inv.recipient.lastName}` : '');
    setFormRecipientSearch('');
    setFormDescription(inv.description || inv.notes || '');
    const items = inv.lineItems || inv.items || [];
    if (items.length > 0) {
      setFormLineItems(items.map(li => ({
        description: li.description,
        quantity: li.quantity || 1,
        unitPrice: li.unitPrice || li.amount || 0,
        total: (li.quantity || 1) * (li.unitPrice || li.amount || 0),
      })));
    } else {
      setFormLineItems([{ description: inv.description || 'Service', quantity: 1, unitPrice: Number(inv.amount || 0), total: Number(inv.amount || 0) }]);
    }
    const invTax = Number(inv.tax || 0);
    const invAmount = Number(inv.amount || 0);
    if (invTax > 0 && invAmount > 0) {
      setFormTaxEnabled(true);
      setFormTaxRate(Math.round((invTax / invAmount) * 100));
    } else {
      setFormTaxEnabled(false);
      setFormTaxRate(16);
    }
    setFormDueDate(inv.dueDate ? inv.dueDate.split('T')[0] : '');
    setEditingInvoiceId(inv.id);
  };

  /* ─── Actions ─── */

  const handleCreateOrEdit = async (sendNow: boolean) => {
    if (!formRecipientId) { addToast('error', 'Please select a recipient'); return; }
    if (formLineItems.every(li => !li.description || li.total === 0)) {
      addToast('error', 'Add at least one line item with a description and amount');
      return;
    }
    if (!formDueDate) { addToast('error', 'Please select a due date'); return; }
    setActionLoading(true);
    try {
      const payload = {
        recipientId: formRecipientId,
        amount: subtotal,
        tax: taxAmount,
        total: grandTotal,
        description: formDescription || undefined,
        lineItems: formLineItems.filter(li => li.description && li.total > 0),
        dueDate: new Date(formDueDate).toISOString(),
      };

      if (editingInvoiceId) {
        // For edit, create a new invoice (backend doesn't have PATCH update, so we void + recreate)
        // Actually the spec says edit is for DRAFT only — we'll just create fresh since the old is DRAFT
        await financialService.voidInvoice(editingInvoiceId);
        const created = await financialService.createInvoice(payload);
        if (sendNow && created?.id) {
          await financialService.sendInvoice(created.id);
          addToast('success', 'Invoice updated and sent');
        } else {
          addToast('success', 'Invoice updated as draft');
        }
      } else {
        const created = await financialService.createInvoice(payload);
        if (sendNow && created?.id) {
          await financialService.sendInvoice(created.id);
          addToast('success', 'Invoice created and sent');
        } else {
          addToast('success', 'Invoice saved as draft');
        }
      }

      setCreateModal(false);
      setEditModal(false);
      resetForm();
      fetchData();
      fetchStats();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.data?.message || 'Failed to save invoice';
      addToast('error', typeof msg === 'string' ? msg : 'Failed to save invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendInvoice = async (inv: InvoiceItem) => {
    setActionLoading(true);
    try {
      await financialService.sendInvoice(inv.id);
      addToast('success', 'Invoice sent');
      fetchData();
      fetchStats();
      if (detailModal) {
        const updated = await financialService.getInvoice(inv.id);
        setSelectedInvoice(updated);
      }
    } catch { addToast('error', 'Failed to send invoice'); }
    finally { setActionLoading(false); }
  };

  const handleMarkPaid = async (inv: InvoiceItem) => {
    setActionLoading(true);
    try {
      await financialService.markInvoicePaid(inv.id);
      addToast('success', 'Invoice marked as paid');
      fetchData();
      fetchStats();
      if (detailModal) {
        const updated = await financialService.getInvoice(inv.id);
        setSelectedInvoice(updated);
      }
    } catch { addToast('error', 'Failed to mark invoice as paid'); }
    finally { setActionLoading(false); }
  };

  const handleVoidInvoice = async (inv: InvoiceItem) => {
    setActionLoading(true);
    try {
      await financialService.voidInvoice(inv.id);
      addToast('success', 'Invoice voided');
      fetchData();
      fetchStats();
      if (detailModal) {
        const updated = await financialService.getInvoice(inv.id);
        setSelectedInvoice(updated);
      }
    } catch { addToast('error', 'Failed to void invoice'); }
    finally { setActionLoading(false); }
  };

  const handleAutoGenerate = async (booking: Booking) => {
    setActionLoading(true);
    try {
      await financialService.autoGenerateInvoice(booking.id);
      addToast('success', 'Invoice generated from booking');
      setBookingModal(false);
      setBookingSearch('');
      setBookingResults([]);
      fetchData();
      fetchStats();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.data?.message || 'Failed to generate invoice';
      addToast('error', typeof msg === 'string' ? msg : 'Failed to generate invoice');
    } finally { setActionLoading(false); }
  };

  const openConfirm = (title: string, message: string, label: string, variant: 'danger' | 'primary', action: () => Promise<void>) => {
    setConfirmDialog({ open: true, title, message, label, variant, action });
  };

  /* ─── Helpers ─── */

  const clearFilters = () => {
    setStatusFilter('');
    setSearch('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasFilters = statusFilter || search || startDate || endDate;

  const isDueDateOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const openDetail = async (inv: InvoiceItem) => {
    setSelectedInvoice(inv);
    setDetailModal(true);
    // Optionally fetch fresh detail
    try {
      const fresh = await financialService.getInvoice(inv.id);
      setSelectedInvoice(fresh);
    } catch { /* keep the existing data */ }
  };

  /* ─── Row action buttons per status ─── */

  const renderRowActions = (inv: InvoiceItem) => {
    const btnBase = 'px-2.5 py-1 text-xs font-medium rounded-md transition-colors';
    const actions: React.ReactNode[] = [];

    if (inv.status === 'DRAFT') {
      actions.push(
        <button key="send" onClick={() => openConfirm('Send Invoice', `Send invoice ${inv.invoiceNumber || inv.id.slice(0, 8)} to the recipient?`, 'Send', 'primary', () => handleSendInvoice(inv))} className={`${btnBase} 0/10 text-blue-600 hover:0/20`}>Send</button>,
        <button key="edit" onClick={() => { populateFormForEdit(inv); setEditModal(true); }} className={`${btnBase} bg-muted text-muted-foreground hover:text-card-foreground`}>Edit</button>,
        <button key="void" onClick={() => openConfirm('Void Invoice', `This will permanently void invoice ${inv.invoiceNumber || inv.id.slice(0, 8)}. This cannot be undone.`, 'Void', 'danger', () => handleVoidInvoice(inv))} className={`${btnBase} bg-red-500/10 text-red-600 hover:bg-red-500/20`}>Void</button>,
      );
    } else if (inv.status === 'SENT') {
      actions.push(
        <button key="paid" onClick={() => openConfirm('Mark as Paid', `Mark invoice ${inv.invoiceNumber || inv.id.slice(0, 8)} as paid?`, 'Mark Paid', 'primary', () => handleMarkPaid(inv))} className={`${btnBase} bg-green-500/10 text-green-600 hover:bg-green-500/20`}>Mark Paid</button>,
        <button key="void" onClick={() => openConfirm('Void Invoice', `This will permanently void invoice ${inv.invoiceNumber || inv.id.slice(0, 8)}. This cannot be undone.`, 'Void', 'danger', () => handleVoidInvoice(inv))} className={`${btnBase} bg-red-500/10 text-red-600 hover:bg-red-500/20`}>Void</button>,
      );
    } else if (inv.status === 'OVERDUE') {
      actions.push(
        <button key="paid" onClick={() => openConfirm('Mark as Paid', `Mark overdue invoice ${inv.invoiceNumber || inv.id.slice(0, 8)} as paid?`, 'Mark Paid', 'primary', () => handleMarkPaid(inv))} className={`${btnBase} bg-green-500/10 text-green-600 hover:bg-green-500/20`}>Mark Paid</button>,
        <button key="void" onClick={() => openConfirm('Void Invoice', `This will permanently void invoice ${inv.invoiceNumber || inv.id.slice(0, 8)}. This cannot be undone.`, 'Void', 'danger', () => handleVoidInvoice(inv))} className={`${btnBase} bg-red-500/10 text-red-600 hover:bg-red-500/20`}>Void</button>,
        <button key="remind" onClick={() => openConfirm('Send Reminder', `Send a payment reminder for invoice ${inv.invoiceNumber || inv.id.slice(0, 8)}?`, 'Send Reminder', 'primary', () => handleSendInvoice(inv))} className={`${btnBase} bg-amber-500/10 text-amber-600 hover:bg-amber-500/20`}>Remind</button>,
      );
    } else {
      actions.push(
        <button key="view" onClick={() => openDetail(inv)} className={`${btnBase} bg-muted text-muted-foreground hover:text-card-foreground`}>View</button>,
      );
    }
    // Download receipt always available
    actions.push(
      <button key="download" onClick={() => downloadReceipt(inv)} className={`${btnBase} bg-[#F77B0F]/10 text-[#F77B0F] hover:bg-gray-50 dark:hover:bg-white/10/20`}>
        <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Receipt</span>
      </button>
    );

    return <div className="flex gap-1.5">{actions}</div>;
  };

  /* ─── Columns ─── */

  const cols: Column<InvoiceItem>[] = [
    {
      key: 'invoiceNumber',
      label: 'Invoice #',
      render: (inv) => (
        <span className="font-mono text-sm font-medium">{inv.invoiceNumber || `INV-${inv.id.slice(0, 6).toUpperCase()}`}</span>
      ),
    },
    {
      key: 'issuer',
      label: 'Issuer',
      render: (inv) =>
        inv.issuer ? (
          <div>
            <p className="font-medium text-sm">{inv.issuer.firstName} {inv.issuer.lastName}</p>
            <p className="text-xs text-muted-foreground hidden sm:block">{inv.issuer.email}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">--</span>
        ),
    },
    {
      key: 'recipient',
      label: 'Recipient',
      render: (inv) =>
        inv.recipient ? (
          <div>
            <p className="font-medium text-sm">{inv.recipient.firstName} {inv.recipient.lastName}</p>
            <p className="text-xs text-muted-foreground hidden sm:block">{inv.recipient.email}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">--</span>
        ),
    },
    {
      key: 'amount',
      label: 'Amount / Tax / Total',
      render: (inv) => (
        <div className="text-sm">
          <span className="text-muted-foreground">{formatCurrency(Number(inv.amount || 0))}</span>
          <span className="text-muted-foreground mx-1">/</span>
          <span className="text-muted-foreground">{formatCurrency(Number(inv.tax || 0))}</span>
          <span className="text-muted-foreground mx-1">/</span>
          <span className="font-semibold">{formatCurrency(Number(inv.total || inv.amount || 0))}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (inv) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || 'bg-gray-100 text-gray-700'}`}>
          {inv.status}
        </span>
      ),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (inv) => {
        if (!inv.dueDate) return <span className="text-muted-foreground text-sm">--</span>;
        const overdue = isDueDateOverdue(inv.dueDate) && !['PAID', 'VOID', 'CANCELLED'].includes(inv.status);
        return (
          <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
            {formatDate(inv.dueDate)}
            {overdue && <span className="ml-1 text-[10px] font-bold uppercase">overdue</span>}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (inv) => <span className="text-muted-foreground text-sm">{formatDate(inv.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (inv) => (
        <div onClick={(e) => e.stopPropagation()}>
          {renderRowActions(inv)}
        </div>
      ),
    },
  ];

  /* ─── Form modal content (shared between create and edit) ─── */

  const renderFormContent = () => (
    <div className="space-y-5">
      {/* Recipient search */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Recipient *</label>
        {formRecipientId ? (
          <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div>
              <p className="text-sm font-medium">{formRecipientName}</p>
              <p className="text-xs text-muted-foreground">Selected</p>
            </div>
            <button onClick={() => { setFormRecipientId(''); setFormRecipientName(''); setFormRecipientSearch(''); }} className="text-xs text-red-500 hover:text-red-600">Remove</button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={formRecipientSearch}
              onChange={e => setFormRecipientSearch(e.target.value)}
              onFocus={() => { setRecipientFocused(true); }}
              onBlur={() => setTimeout(() => setRecipientFocused(false), 200)}
              placeholder="Search users by name or email..."
              className={icFull}
            />
            {searchingRecipients && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="w-4 h-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
              </div>
            )}
            {recipientFocused && recipientResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {recipientResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setFormRecipientId(u.id);
                      setFormRecipientName(`${u.firstName} ${u.lastName}`);
                      setFormRecipientSearch('');
                      setRecipientResults([]);
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

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Description</label>
        <textarea
          value={formDescription}
          onChange={e => setFormDescription(e.target.value)}
          rows={2}
          placeholder="Invoice description or notes..."
          className={icFull}
        />
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Line Items *</label>
          <button onClick={addLineItem} className="text-xs font-medium text-primary-500 hover:text-primary-600 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Row
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-20">Qty</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">Unit Price</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">Total</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {formLineItems.map((li, i) => (
                <tr key={i} className="bg-card">
                  <td className="px-2 py-1.5">
                    <input
                      value={li.description}
                      onChange={e => updateLineItem(i, 'description', e.target.value)}
                      placeholder="Item description"
                      className="w-full px-2 py-1.5 rounded border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      value={li.quantity || ''}
                      onChange={e => updateLineItem(i, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-border bg-transparent text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={li.unitPrice || ''}
                      onChange={e => updateLineItem(i, 'unitPrice', e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-border bg-transparent text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium text-sm">
                    {formatCurrency(li.total)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {formLineItems.length > 1 && (
                      <button onClick={() => removeLineItem(i)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax toggle */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formTaxEnabled}
            onChange={e => setFormTaxEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary-500 focus:ring-primary-500/50"
          />
          Apply Tax
        </label>
        {formTaxEnabled && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={formTaxRate}
              onChange={e => setFormTaxRate(Number(e.target.value))}
              className="w-16 px-2 py-1 rounded border border-border bg-card text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="p-4 rounded-lg bg-muted/50 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>
        {formTaxEnabled && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({formTaxRate}%)</span>
            <span className="font-medium">{formatCurrency(taxAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold border-t border-border pt-2">
          <span>Total</span>
          <span>{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      {/* Due date */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Due Date *</label>
        <input
          type="date"
          value={formDueDate}
          onChange={e => setFormDueDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className={icFull}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <button onClick={() => { setCreateModal(false); setEditModal(false); resetForm(); }} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
          Cancel
        </button>
        <button
          onClick={() => handleCreateOrEdit(false)}
          disabled={actionLoading}
          className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          {actionLoading ? 'Saving...' : 'Save as Draft'}
        </button>
        <button
          onClick={() => handleCreateOrEdit(true)}
          disabled={actionLoading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
        >
          {actionLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
              Sending...
            </>
          ) : 'Send Now'}
        </button>
      </div>
    </div>
  );

  /* ─── Detail modal action buttons ─── */

  const renderDetailActions = (inv: InvoiceItem) => {
    const btnBase = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors';
    const actions: React.ReactNode[] = [];

    if (inv.status === 'DRAFT') {
      actions.push(
        <button key="send" onClick={() => openConfirm('Send Invoice', `Send this invoice to the recipient?`, 'Send', 'primary', () => handleSendInvoice(inv))} className={`${btnBase} 0 text-white hover:bg-blue-600`}>Send Invoice</button>,
        <button key="edit" onClick={() => { setDetailModal(false); populateFormForEdit(inv); setEditModal(true); }} className={`${btnBase} border border-border hover:bg-muted`}>Edit</button>,
        <button key="void" onClick={() => openConfirm('Void Invoice', `This will permanently void this invoice. This cannot be undone.`, 'Void', 'danger', () => handleVoidInvoice(inv))} className={`${btnBase} bg-red-500/10 text-red-600 hover:bg-red-500/20`}>Void</button>,
      );
    } else if (inv.status === 'SENT') {
      actions.push(
        <button key="paid" onClick={() => openConfirm('Mark as Paid', `Mark this invoice as paid?`, 'Mark Paid', 'primary', () => handleMarkPaid(inv))} className={`${btnBase} bg-green-500 text-white hover:bg-green-600`}>Mark Paid</button>,
        <button key="void" onClick={() => openConfirm('Void Invoice', `This will permanently void this invoice. This cannot be undone.`, 'Void', 'danger', () => handleVoidInvoice(inv))} className={`${btnBase} bg-red-500/10 text-red-600 hover:bg-red-500/20`}>Void</button>,
        <button key="resend" onClick={() => handleSendInvoice(inv)} className={`${btnBase} border border-border hover:bg-muted`}>Resend</button>,
      );
    } else if (inv.status === 'OVERDUE') {
      actions.push(
        <button key="paid" onClick={() => openConfirm('Mark as Paid', `Mark this overdue invoice as paid?`, 'Mark Paid', 'primary', () => handleMarkPaid(inv))} className={`${btnBase} bg-green-500 text-white hover:bg-green-600`}>Mark Paid</button>,
        <button key="void" onClick={() => openConfirm('Void Invoice', `This will permanently void this invoice. This cannot be undone.`, 'Void', 'danger', () => handleVoidInvoice(inv))} className={`${btnBase} bg-red-500/10 text-red-600 hover:bg-red-500/20`}>Void</button>,
        <button key="remind" onClick={() => handleSendInvoice(inv)} className={`${btnBase} bg-amber-500 text-white hover:bg-amber-600`}>Send Reminder</button>,
      );
    }

    // Download receipt always available in detail modal
    actions.push(
      <button key="download" onClick={() => downloadReceipt(inv)} className={`${btnBase} border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent hover:bg-gray-50 dark:hover:bg-white/10 flex items-center gap-2`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        Download Receipt
      </button>
    );
    return <div className="flex flex-wrap gap-3 pt-4 border-t border-border">{actions}</div>;
  };

  /* ─── Render ─── */

  return (
    <div>
      <PageHeader
        title="Invoices"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Invoices' },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setBookingSearch(''); setBookingResults([]); setBookingModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium text-card-foreground hover:bg-muted transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Generate from Booking
            </button>
            <button
              onClick={() => { resetForm(); setCreateModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F77B0F] hover:bg-[#0f1e47] text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Create Invoice
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {/* Total Invoices */}
        <div className="col-span-2 sm:col-span-1 lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Total Invoices</p>
          <p className="text-4xl font-black tabular-nums text-card-foreground leading-none">{stats.totalCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">{formatCurrency(stats.totalAmount)}</p>
        </div>

        {/* Paid */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Paid</p>
          </div>
          <p className="text-3xl font-black tabular-nums text-card-foreground leading-none">{stats.paidCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">{formatCurrency(stats.paidAmount)}</p>
        </div>

        {/* Outstanding */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Outstanding</p>
          </div>
          <p className="text-3xl font-black tabular-nums text-card-foreground leading-none">{stats.outstandingCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">{formatCurrency(stats.outstandingAmount)}</p>
        </div>

        {/* Overdue */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Overdue</p>
          </div>
          <p className="text-3xl font-black tabular-nums text-card-foreground leading-none">{stats.overdueCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">invoices</p>
        </div>

        {/* Draft */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Draft</p>
          </div>
          <p className="text-3xl font-black tabular-nums text-card-foreground leading-none">{stats.draftCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">not sent</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {(['', ...INVOICE_STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  statusFilter === s
                    ? 'bg-[#F77B0F] text-white'
                    : 'bg-muted text-muted-foreground hover:text-card-foreground hover:bg-muted/80'
                }`}
              >
                {s === '' ? 'All' : s}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="hidden sm:block h-6 w-px bg-border mx-1" />

          {/* Search */}
          <div className="relative">
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search issuer/recipient…"
              className={`${ic} w-48 pl-8 text-xs`}
            />
          </div>

          {/* Date range */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className={`${ic} w-36 text-xs`}
          />
          <span className="text-muted-foreground text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className={`${ic} w-36 text-xs`}
          />

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto px-3 py-1.5 text-xs rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              ✕ Clear
            </button>
          )}
          {!hasFilters && total > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">{total} invoice{total !== 1 ? 's' : ''}</span>
          )}
          {hasFilters && total > 0 && (
            <span className="text-xs text-muted-foreground">{total} result{total !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={cols}
        data={data}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        onRowClick={(inv) => openDetail(inv)}
        keyExtractor={(inv) => inv.id}
        emptyMessage="No invoices found"
      />

      {/* ==================== DETAIL MODAL ==================== */}
      <Modal
        isOpen={detailModal}
        onClose={() => { setDetailModal(false); setSelectedInvoice(null); }}
        title="Invoice Details"
        size="xl"
      >
        {selectedInvoice && (
          <div className="space-y-5">
            {/* Header row */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">
                  {selectedInvoice.invoiceNumber || `INV-${selectedInvoice.id.slice(0, 6).toUpperCase()}`}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{formatDateTime(selectedInvoice.createdAt)}</p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusColors[selectedInvoice.status] || 'bg-gray-100 text-gray-700'}`}>
                {selectedInvoice.status}
              </span>
            </div>

            {/* Issuer / Recipient */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">From (Issuer)</span>
                {selectedInvoice.issuer ? (
                  <>
                    <p className="font-semibold mt-1.5">{selectedInvoice.issuer.firstName} {selectedInvoice.issuer.lastName}</p>
                    <p className="text-sm text-muted-foreground">{selectedInvoice.issuer.email}</p>
                  </>
                ) : (
                  <p className="mt-1.5 text-muted-foreground">--</p>
                )}
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">To (Recipient)</span>
                {selectedInvoice.recipient ? (
                  <>
                    <p className="font-semibold mt-1.5">{selectedInvoice.recipient.firstName} {selectedInvoice.recipient.lastName}</p>
                    <p className="text-sm text-muted-foreground">{selectedInvoice.recipient.email}</p>
                  </>
                ) : (
                  <p className="mt-1.5 text-muted-foreground">--</p>
                )}
              </div>
            </div>

            {/* Description */}
            {(selectedInvoice.description || selectedInvoice.notes) && (
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground font-medium">Description</span>
                <p className="text-sm mt-1">{selectedInvoice.description || selectedInvoice.notes}</p>
              </div>
            )}

            {/* Line Items */}
            {(() => {
              const items = selectedInvoice.lineItems || selectedInvoice.items || [];
              return items.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Line Items</h4>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Description</th>
                          <th className="px-4 py-2 text-right font-medium text-muted-foreground">Qty</th>
                          <th className="px-4 py-2 text-right font-medium text-muted-foreground">Unit Price</th>
                          <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map((item, i) => (
                          <tr key={i} className="bg-card">
                            <td className="px-4 py-2">{item.description}</td>
                            <td className="px-4 py-2 text-right text-muted-foreground">{item.quantity || 1}</td>
                            <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(Number(item.unitPrice || item.amount || 0))}</td>
                            <td className="px-4 py-2 text-right font-medium">{formatCurrency(Number((item.quantity || 1) * (item.unitPrice || item.amount || 0)))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Totals */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Subtotal</span>
                <p className="font-semibold mt-1">{formatCurrency(Number(selectedInvoice.amount || 0))}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Tax</span>
                <p className="font-semibold mt-1">{formatCurrency(Number(selectedInvoice.tax || 0))}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary-500/5 border border-primary-500/20">
                <span className="text-xs text-muted-foreground">Total</span>
                <p className="font-bold text-lg mt-1">{formatCurrency(Number(selectedInvoice.total || selectedInvoice.amount || 0))}</p>
              </div>
            </div>

            {/* Status timeline / Dates */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Timeline</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span className="text-muted-foreground w-24">Created</span>
                  <span>{formatDateTime(selectedInvoice.createdAt)}</span>
                </div>
                {selectedInvoice.dueDate && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full ${isDueDateOverdue(selectedInvoice.dueDate) && !['PAID', 'VOID', 'CANCELLED'].includes(selectedInvoice.status) ? 'bg-red-500' : 'bg-amber-400'}`}></div>
                    <span className="text-muted-foreground w-24">Due Date</span>
                    <span className={isDueDateOverdue(selectedInvoice.dueDate) && !['PAID', 'VOID', 'CANCELLED'].includes(selectedInvoice.status) ? 'text-red-600 font-medium' : ''}>
                      {formatDate(selectedInvoice.dueDate)}
                    </span>
                  </div>
                )}
                {selectedInvoice.sentAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full 0"></div>
                    <span className="text-muted-foreground w-24">Sent</span>
                    <span>{formatDateTime(selectedInvoice.sentAt)}</span>
                  </div>
                )}
                {selectedInvoice.paidAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-muted-foreground w-24">Paid</span>
                    <span>{formatDateTime(selectedInvoice.paidAt)}</span>
                  </div>
                )}
                {selectedInvoice.voidedAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                    <span className="text-muted-foreground w-24">Voided</span>
                    <span>{formatDateTime(selectedInvoice.voidedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Booking reference */}
            {selectedInvoice.bookingId && (
              <div className="p-3 rounded-lg bg-muted/50">
                <span className="text-xs text-muted-foreground">Linked Booking</span>
                <p className="text-sm font-mono mt-1">{selectedInvoice.bookingId}</p>
              </div>
            )}

            {/* Action buttons */}
            {renderDetailActions(selectedInvoice)}
          </div>
        )}
      </Modal>

      {/* ==================== CREATE INVOICE MODAL ==================== */}
      <Modal
        isOpen={createModal}
        onClose={() => { setCreateModal(false); resetForm(); }}
        title="Create Invoice"
        size="xl"
      >
        {renderFormContent()}
      </Modal>

      {/* ==================== EDIT INVOICE MODAL ==================== */}
      <Modal
        isOpen={editModal}
        onClose={() => { setEditModal(false); resetForm(); }}
        title="Edit Invoice"
        size="xl"
      >
        {renderFormContent()}
      </Modal>

      {/* ==================== AUTO-GENERATE FROM BOOKING MODAL ==================== */}
      <Modal
        isOpen={bookingModal}
        onClose={() => { setBookingModal(false); setBookingSearch(''); setBookingResults([]); }}
        title="Generate Invoice from Booking"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Search for a completed booking to automatically generate an invoice from it.</p>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={bookingSearch}
              onChange={e => setBookingSearch(e.target.value)}
              placeholder="Search by client, trainer, or booking ID..."
              className={`${icFull} pl-9`}
              autoFocus
            />
            {searchingBookings && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="w-4 h-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
              </div>
            )}
          </div>

          {bookingResults.length > 0 ? (
            <div className="divide-y divide-border rounded-lg border border-border max-h-80 overflow-y-auto">
              {bookingResults.map(b => {
                const client = b.client as any;
                const trainer = b.trainer as any;
                return (
                  <button
                    key={b.id}
                    onClick={() => openConfirm(
                      'Generate Invoice',
                      `Generate an invoice from booking ${b.id.slice(0, 8)} (${formatCurrency(Number(b.amount))})?`,
                      'Generate',
                      'primary',
                      () => handleAutoGenerate(b),
                    )}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">{b.id.slice(0, 8)}</span>
                        <p className="text-sm font-medium mt-0.5">
                          {client?.firstName} {client?.lastName}
                          <span className="text-muted-foreground mx-1.5">with</span>
                          {trainer?.firstName || trainer?.user?.firstName} {trainer?.lastName || trainer?.user?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(b.scheduledAt)} - {b.duration}min</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(Number(b.amount))}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {b.status}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : !searchingBookings ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {bookingSearch ? 'No completed bookings found' : 'Start typing to search completed bookings'}
            </div>
          ) : null}
        </div>
      </Modal>

      {/* ==================== CONFIRM DIALOG ==================== */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={async () => {
          await confirmDialog.action();
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.label}
        confirmVariant={confirmDialog.variant}
        loading={actionLoading}
      />
    </div>
  );
}
