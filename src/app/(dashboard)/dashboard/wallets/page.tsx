'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { walletService } from '@/lib/services/walletService';
import { Wallet } from '@/lib/types';
import { useToast } from '@/lib/toast';

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fundModal, setFundModal] = useState<{ open: boolean; wallet: Wallet | null }>({ open: false, wallet: null });
  const [bulkModal, setBulkModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await walletService.getAll();
      setWallets(data);
    } catch {
      addToast('error', 'Failed to load wallets');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = wallets.filter(w =>
    w.user?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    w.user?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
    w.user?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleFund = async () => {
    if (!fundModal.wallet || !amount) return;
    setSubmitting(true);
    try {
      await walletService.adminFund(fundModal.wallet.userId, Number(amount), description || undefined);
      addToast('success', `KES ${Number(amount).toLocaleString()} added to ${fundModal.wallet.user?.firstName}'s wallet`);
      setFundModal({ open: false, wallet: null });
      setAmount(''); setDescription('');
      load();
    } catch (e: any) {
      addToast('error', e?.response?.data?.message || 'Failed to fund wallet');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkFund = async () => {
    if (!amount) return;
    setSubmitting(true);
    try {
      await Promise.all(wallets.map(w => walletService.adminFund(w.userId, Number(amount), description || 'Bulk starter credit')));
      addToast('success', `KES ${Number(amount).toLocaleString()} added to all ${wallets.length} wallets`);
      setBulkModal(false);
      setAmount(''); setDescription('');
      load();
    } catch (e: any) {
      addToast('error', e?.response?.data?.message || 'Bulk fund failed');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: number) => `KES ${Number(n).toLocaleString()}`;

  const columns: Column<Wallet>[] = [
    {
      key: 'user',
      label: 'User',
      render: (w) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {w.user?.firstName} {w.user?.lastName}
          </p>
          <p className="text-xs text-gray-500">{w.user?.email}</p>
        </div>
      ),
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (w) => (
        <span className="font-semibold text-gray-900 dark:text-white">{fmt(w.balance)}</span>
      ),
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (w) => <span className="text-gray-500">{w.currency}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (w) => (
        <button
          onClick={() => { setFundModal({ open: true, wallet: w }); setAmount(''); setDescription(''); }}
          className="px-3 py-1 text-xs font-medium bg-[#F77B0F] hover:bg-[#e06a00] text-white rounded-lg transition-colors"
        >
          Top Up
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallets"
        subtitle={`${wallets.length} wallets · Total: ${fmt(wallets.reduce((s, w) => s + Number(w.balance), 0))}`}
        actions={
          <button
            onClick={() => { setBulkModal(true); setAmount('1000000'); setDescription('Starter credit'); }}
            className="px-4 py-2 bg-[#F77B0F] hover:bg-[#1a3480] text-white text-sm font-medium rounded-lg transition-colors"
          >
            Bulk Top Up All
          </button>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F77B0F]"
        />
      </div>

      <DataTable columns={columns} data={filtered} loading={loading} />

      {/* Single wallet top-up modal */}
      <Modal
        isOpen={fundModal.open}
        onClose={() => setFundModal({ open: false, wallet: null })}
        title={`Top Up — ${fundModal.wallet?.user?.firstName} ${fundModal.wallet?.user?.lastName}`}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current balance</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {fundModal.wallet ? fmt(fundModal.wallet.balance) : '—'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (KES)</label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 1000000"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F77B0F]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Starter credit"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F77B0F]"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setFundModal({ open: false, wallet: null })} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button
              onClick={handleFund}
              disabled={submitting || !amount}
              className="flex-1 px-4 py-2 bg-[#F77B0F] hover:bg-[#e06a00] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? 'Funding…' : `Add ${amount ? `KES ${Number(amount).toLocaleString()}` : ''}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk top-up modal */}
      <Modal isOpen={bulkModal} onClose={() => setBulkModal(false)} title={`Bulk Top Up — All ${wallets.length} Users`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will add the specified amount to <strong>every</strong> wallet on the platform.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount per wallet (KES)</label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F77B0F]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F77B0F]"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setBulkModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button
              onClick={handleBulkFund}
              disabled={submitting || !amount}
              className="flex-1 px-4 py-2 bg-[#F77B0F] hover:bg-[#1a3480] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? `Funding ${wallets.length} wallets…` : `Top Up All ${wallets.length} Wallets`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
