'use client';

import React, { useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatsCard } from '@/components/StatsCard';
import { reconciliationService, ReconciliationEntry, ReconciliationSummary } from '@/lib/services/reconciliationService';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const ic =
  'px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50';

function today() {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function downloadCsv(entries: ReconciliationEntry[], from: string, to: string) {
  const headers = ['Date', 'Transaction ID', 'Type', 'Debit', 'Credit', 'Running Balance', 'User'];
  const rows = entries.map((r) => [
    r.date,
    r.transactionId,
    r.type,
    String(r.debit),
    String(r.credit),
    String(r.runningBalance),
    r.user,
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reconciliation_${from}_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const Icon = ({ d }: { d: string }) => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

export default function ReconciliationPage() {
  const { addToast } = useToast();

  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [entries, setEntries] = useState<ReconciliationEntry[]>([]);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!from || !to) {
      addToast('error', 'Please select a date range');
      return;
    }
    if (from > to) {
      addToast('error', '"From" date must be before "To" date');
      return;
    }
    setLoading(true);
    try {
      const report = await reconciliationService.getReport(from, to);
      setSummary(report.summary);
      setEntries(Array.isArray(report.entries) ? report.entries : []);
      setGenerated(true);
    } catch {
      addToast('error', 'Failed to generate reconciliation report');
    } finally {
      setLoading(false);
    }
  }, [from, to, addToast]);

  const cols: Column<ReconciliationEntry>[] = [
    {
      key: 'date',
      label: 'Date',
      render: (r) => <span className="text-muted-foreground text-xs">{formatDateTime(r.date)}</span>,
    },
    {
      key: 'transactionId',
      label: 'Transaction ID',
      render: (r) => <span className="font-mono text-xs">{r.transactionId?.slice(0, 12)}…</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (r) => (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">{r.type}</span>
      ),
    },
    {
      key: 'debit',
      label: 'Debit',
      render: (r) =>
        r.debit > 0 ? (
          <span className="text-red-600 dark:text-red-400 font-medium">{formatCurrency(r.debit)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'credit',
      label: 'Credit',
      render: (r) =>
        r.credit > 0 ? (
          <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(r.credit)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'runningBalance',
      label: 'Running Balance',
      render: (r) => (
        <span className="font-semibold">{formatCurrency(r.runningBalance)}</span>
      ),
    },
    {
      key: 'user',
      label: 'User',
      render: (r) => <span className="text-sm">{r.user}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Financial Reconciliation"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Finance', href: '/dashboard/transactions' },
          { label: 'Reconciliation' },
        ]}
        actions={
          generated && entries.length > 0 ? (
            <button
              onClick={() => downloadCsv(entries, from, to)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          ) : undefined
        }
      />

      {/* Date Range Picker */}
      <div className="flex flex-wrap items-end gap-3 mb-6 p-4 rounded-xl border border-border bg-card">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={ic}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={ic}
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#192C67] hover:bg-[#0f1e47] text-white text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
              Running…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Run Reconciliation
            </>
          )}
        </button>
        {/* Quick presets */}
        <div className="flex gap-2 ml-2">
          {[
            { label: '7d', days: 7 },
            { label: '30d', days: 30 },
            { label: '90d', days: 90 },
          ].map((p) => (
            <button
              key={p.label}
              onClick={() => { setFrom(daysAgo(p.days)); setTo(today()); }}
              className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-muted transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Imbalance Alert */}
      {generated && summary && !summary.isBalanced && (
        <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-semibold text-sm">Ledger Imbalance Detected</p>
            <p className="text-xs mt-0.5">
              Total debits ({formatCurrency(summary.totalDebits)}) do not match total credits ({formatCurrency(summary.totalCredits)}). Investigate discrepancy of {formatCurrency(Math.abs(summary.totalDebits - summary.totalCredits))}.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {generated && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatsCard
            label="Total Debits"
            value={formatCurrency(summary.totalDebits)}
            icon={<Icon d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />}
          />
          <StatsCard
            label="Total Credits"
            value={formatCurrency(summary.totalCredits)}
            icon={<Icon d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />}
          />
          <StatsCard
            label="Net Balance"
            value={formatCurrency(summary.netBalance)}
            icon={<Icon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />}
          />
          <StatsCard
            label="Commission Earned"
            value={formatCurrency(summary.commissionEarned)}
            icon={<Icon d="M9 7h6m0 10v-3m-3 3v-6m-3 6v-1m6-9a2 2 0 002-2H7a2 2 0 00-2 2h14zM5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />}
          />
          <StatsCard
            label="Total Refunds"
            value={formatCurrency(summary.totalRefunds)}
            icon={<Icon d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />}
          />
        </div>
      )}

      {/* Ledger Table */}
      {generated ? (
        <DataTable
          columns={cols}
          data={entries}
          loading={loading}
          keyExtractor={(r) => r.id}
          emptyMessage="No ledger entries found for the selected date range"
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-border bg-card">
          <svg className="w-14 h-14 text-muted-foreground/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3v-6m-3 6v-1m6-9a2 2 0 002-2H7a2 2 0 00-2 2h14zM5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-muted-foreground text-sm">Select a date range and click Generate Report</p>
        </div>
      )}
    </div>
  );
}
