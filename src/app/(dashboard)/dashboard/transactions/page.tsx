'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { walletService } from '@/lib/services/walletService';
import { Wallet, Transaction } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatNumber, formatDateTime, getInitials } from '@/lib/utils';

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        {accent && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-2xl font-bold text-card-foreground tabular-nums">{value}</span>
    </div>
  );
}

const ic = 'w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#192C67]/30';

export default function TransactionsPage() {
  const { addToast } = useToast();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  // Fund wallet modal
  const [fundModal, setFundModal] = useState(false);
  const [fundForm, setFundForm] = useState({ userId: '', amount: 0, description: '' });
  const [fundLoading, setFundLoading] = useState(false);

  // Transaction detail modal
  const [txModal, setTxModal] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await walletService.getAll();
      setWallets(Array.isArray(data) ? data : []);
    } catch {
      addToast('error', 'Failed to load wallets');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);
  const totalHeld = wallets.reduce((sum, w) => sum + Number(w.holdBalance || 0), 0);

  const handleFund = async () => {
    if (!fundForm.userId || fundForm.amount <= 0) {
      addToast('error', 'Select a user and enter a valid amount');
      return;
    }
    setFundLoading(true);
    try {
      await walletService.adminFund(fundForm.userId, fundForm.amount, fundForm.description);
      addToast('success', 'Wallet funded successfully');
      setFundModal(false);
      setFundForm({ userId: '', amount: 0, description: '' });
      fetchData();
    } catch {
      addToast('error', 'Failed to fund wallet');
    } finally {
      setFundLoading(false);
    }
  };

  const handleRowClick = async (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setTxModal(true);
    setTxLoading(true);
    try {
      const data = await walletService.getTransactions();
      const filtered = Array.isArray(data)
        ? data.filter((tx) => tx.walletId === wallet.id || tx.userId === wallet.userId)
        : [];
      setTransactions(filtered);
    } catch {
      addToast('error', 'Failed to load transactions');
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  };

  const walletCols: Column<Wallet>[] = [
    {
      key: 'avatar',
      label: '',
      className: 'w-10',
      render: (w) => {
        const u = w.user;
        return (
          <div className="w-9 h-9 rounded-full bg-[#192C67]/10 text-[#192C67] dark:bg-[#192C67]/20 dark:text-blue-300 flex items-center justify-center text-xs font-semibold">
            {getInitials(u?.firstName, u?.lastName)}
          </div>
        );
      },
    },
    {
      key: 'user',
      label: 'User',
      render: (w) => {
        const u = w.user;
        return u ? (
          <div>
            <p className="font-medium text-card-foreground">{u.firstName} {u.lastName}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
        ) : (
          <span className="text-xs font-mono text-muted-foreground">{w.userId.slice(0, 8)}</span>
        );
      },
    },
    {
      key: 'role',
      label: 'Role',
      render: (w) => {
        const u = w.user;
        return u?.role ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground">
            {u.role}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: 'balance',
      label: 'Balance',
      sortable: true,
      render: (w) => (
        <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums">
          {formatCurrency(Number(w.balance || 0))}
        </span>
      ),
    },
    {
      key: 'holdBalance',
      label: 'On Hold',
      render: (w) => {
        const hold = Number(w.holdBalance || 0);
        return hold > 0 ? (
          <span className="font-medium text-amber-600 dark:text-amber-400 tabular-nums">
            {formatCurrency(hold)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: 'currency',
      label: 'CCY',
      render: (w) => (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {w.currency || 'KES'}
        </span>
      ),
    },
    {
      key: 'fund',
      label: '',
      render: (w) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setFundForm({ userId: w.userId, amount: 0, description: '' });
            setFundModal(true);
          }}
          className="px-3 py-1 text-xs font-medium rounded-lg bg-[#192C67]/10 text-[#192C67] dark:text-blue-300 hover:bg-[#192C67]/20 transition-colors"
        >
          Fund
        </button>
      ),
    },
  ];

  const txCols: Column<Transaction>[] = [
    {
      key: 'type',
      label: 'Type',
      render: (tx) => <StatusBadge status={tx.type} />,
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (tx) => {
        const isCredit = tx.type === 'CREDIT' || tx.type === 'RELEASE' || tx.type === 'REFUND';
        return (
          <span className={`font-semibold tabular-nums ${isCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isCredit ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}
          </span>
        );
      },
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (tx) => <span className="text-xs font-mono text-muted-foreground">{tx.reference || '—'}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      render: (tx) => <span className="text-sm text-muted-foreground">{tx.description || '—'}</span>,
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (tx) => (
        <span className="text-xs text-muted-foreground">{formatDateTime(tx.createdAt)}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Wallets & Transactions"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Transactions' }]}
        actions={
          <button
            onClick={() => {
              setFundForm({ userId: '', amount: 0, description: '' });
              setFundModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#192C67] hover:bg-[#0f1e47] text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Fund Wallet
          </button>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Total Wallets" value={formatNumber(wallets.length)} />
        <MetricCard label="Total Balance" value={formatCurrency(totalBalance)} accent="#192C67" />
        <MetricCard label="Total On Hold" value={formatCurrency(totalHeld)} accent="#F59E0B" />
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-card-foreground">All Wallets</p>
        {wallets.length > 0 && (
          <p className="text-xs text-muted-foreground">{wallets.length} wallets · click a row to view transactions</p>
        )}
      </div>

      <DataTable
        columns={walletCols}
        data={wallets}
        loading={loading}
        keyExtractor={(w) => w.id}
        onRowClick={handleRowClick}
        emptyMessage="No wallets found"
      />

      {/* ── Fund Wallet Modal ── */}
      <Modal isOpen={fundModal} onClose={() => setFundModal(false)} title="Fund Wallet" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">User*</label>
            {fundForm.userId ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#192C67]/5 border border-[#192C67]/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#192C67]/10 flex items-center justify-center text-[10px] font-bold text-[#192C67]">
                    {(() => {
                      const w = wallets.find(w => w.userId === fundForm.userId);
                      const u = w?.user;
                      return u ? `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}` : '?';
                    })()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">
                      {(() => {
                        const w = wallets.find(w => w.userId === fundForm.userId);
                        const u = w?.user;
                        return u ? `${u.firstName} ${u.lastName}` : fundForm.userId.slice(0, 8);
                      })()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {wallets.find(w => w.userId === fundForm.userId)?.user?.email || ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFundForm({ ...fundForm, userId: '' })}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={(fundForm as any)._search || ''}
                  onChange={(e) => setFundForm({ ...fundForm, _search: e.target.value } as any)}
                  placeholder="Search by name or email..."
                  className={ic}
                />
                <div className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-card shadow-sm">
                  {wallets
                    .filter(w => {
                      const s = ((fundForm as any)._search || '').toLowerCase();
                      if (!s) return true;
                      const u = w.user;
                      return `${u?.firstName || ''} ${u?.lastName || ''} ${u?.email || ''}`.toLowerCase().includes(s);
                    })
                    .map(w => {
                      const u = w.user;
                      return (
                        <button
                          key={w.userId}
                          type="button"
                          onClick={() => setFundForm({ ...fundForm, userId: w.userId, _search: '' } as any)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                        >
                          <div className="w-7 h-7 rounded-full bg-[#192C67]/10 flex items-center justify-center text-[10px] font-bold text-[#192C67] flex-shrink-0">
                            {u ? `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}` : '?'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{u ? `${u.firstName} ${u.lastName}` : w.userId.slice(0, 8)}</p>
                            <p className="text-xs text-muted-foreground truncate">{u?.email || ''}{u?.role ? ` · ${u.role}` : ''}</p>
                          </div>
                          <span className="text-xs font-medium text-green-600 dark:text-green-400 flex-shrink-0 tabular-nums">
                            {formatCurrency(Number(w.balance || 0))}
                          </span>
                        </button>
                      );
                    })}
                  {wallets.filter(w => {
                    const s = ((fundForm as any)._search || '').toLowerCase();
                    if (!s) return true;
                    const u = w.user;
                    return `${u?.firstName || ''} ${u?.lastName || ''} ${u?.email || ''}`.toLowerCase().includes(s);
                  }).length === 0 && (
                    <p className="px-3 py-4 text-xs text-center text-muted-foreground">No users found</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Amount (KES)*</label>
            <input
              type="number"
              min="1"
              value={fundForm.amount || ''}
              onChange={(e) => setFundForm({ ...fundForm, amount: Number(e.target.value) })}
              placeholder="0.00"
              className={ic}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Note</label>
            <input
              value={fundForm.description}
              onChange={(e) => setFundForm({ ...fundForm, description: e.target.value })}
              placeholder="Optional — reason for funding..."
              className={ic}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              onClick={() => setFundModal(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleFund}
              disabled={fundLoading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#192C67] hover:bg-[#0f1e47] text-white text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              {fundLoading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Funding…
                </>
              ) : 'Fund Wallet'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Transaction Detail Modal ── */}
      <Modal
        isOpen={txModal}
        onClose={() => {
          setTxModal(false);
          setSelectedWallet(null);
          setTransactions([]);
        }}
        title={
          selectedWallet?.user
            ? `${selectedWallet.user.firstName} ${selectedWallet.user.lastName} — Transactions`
            : 'Wallet Transactions'
        }
        size="xl"
      >
        {selectedWallet && (
          <>
            {/* Wallet summary bar */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="p-3 rounded-xl bg-card border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Balance</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
                  {formatCurrency(Number(selectedWallet.balance || 0))}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">On Hold</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {formatCurrency(Number(selectedWallet.holdBalance || 0))}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Currency</p>
                <p className="text-lg font-bold text-card-foreground">{selectedWallet.currency || 'KES'}</p>
              </div>
            </div>

            {/* Transaction count header */}
            {!txLoading && transactions.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-card-foreground">Transaction History</p>
                <p className="text-xs text-muted-foreground">{transactions.length} entries</p>
              </div>
            )}

            {txLoading ? (
              <div className="flex items-center justify-center py-16">
                <svg className="w-8 h-8 animate-spin text-[#192C67]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-card-foreground">No transactions yet</p>
                <p className="text-xs text-muted-foreground mt-1">This wallet has no recorded transactions.</p>
              </div>
            ) : (
              <DataTable
                columns={txCols}
                data={transactions}
                keyExtractor={(tx) => tx.id}
                emptyMessage="No transactions"
              />
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
