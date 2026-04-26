'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { companyService, AdminCompany } from '@/lib/services/companyService';
import { useToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';

const ic = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors';

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Education', 'Retail',
  'Manufacturing', 'Media', 'Consulting', 'Real Estate', 'Other',
];

export default function CompaniesPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 10;

  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await companyService.list({ page, limit: LIMIT, search, industry: industryFilter });
      setCompanies(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / LIMIT)));
    } catch {
      addToast('error', 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [page, search, industryFilter, addToast]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const handleVerifyToggle = async (company: AdminCompany) => {
    const newVal = !company.isVerified;
    // Optimistic update
    setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, isVerified: newVal } : c));
    setActionLoading(company.id);
    try {
      await companyService.verify(company.id, newVal);
      addToast('success', newVal ? `${company.name} verified` : `${company.name} unverified`);
      fetchCompanies();
    } catch {
      // Revert
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, isVerified: company.isVerified } : c));
      addToast('error', 'Failed to update verification');
    } finally {
      setActionLoading(null);
    }
  };

  const cols: Column<AdminCompany>[] = [
    {
      key: 'name',
      label: 'Company',
      sortable: true,
      render: c => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-xs font-bold text-primary-500 shrink-0">
            {c.name[0]?.toUpperCase() || '?'}
          </div>
          <span className="font-medium text-card-foreground">{c.name}</span>
        </div>
      ),
    },
    {
      key: 'industry',
      label: 'Industry',
      render: c => <span className="text-sm text-muted-foreground">{c.industry || '-'}</span>,
    },
    {
      key: 'size',
      label: 'Size',
      render: c => <span className="text-sm">{c.size || '-'}</span>,
    },
    {
      key: 'location',
      label: 'Location',
      render: c => <span className="text-sm text-muted-foreground">{c.location || '-'}</span>,
    },
    {
      key: 'isVerified',
      label: 'Verified',
      render: c => c.isVerified
        ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Verified
          </span>
        : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Unverified</span>,
    },
    {
      key: 'jobs',
      label: 'Jobs',
      render: c => <span className="font-medium text-sm">{c._count?.jobs ?? 0}</span>,
    },
    {
      key: 'recruiters',
      label: 'Recruiters',
      render: c => <span className="font-medium text-sm">{c._count?.recruiters ?? 0}</span>,
    },
    {
      key: 'createdAt',
      label: 'Joined',
      sortable: true,
      render: c => <span className="text-muted-foreground text-sm">{formatDate(c.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: c => (
        <div onClick={e => e.stopPropagation()}>
          <button
            onClick={() => handleVerifyToggle(c)}
            disabled={actionLoading === c.id}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
              c.isVerified
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
            }`}
          >
            {actionLoading === c.id ? '...' : c.isVerified ? 'Unverify' : 'Verify'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Companies"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Companies' }]}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search companies..."
            className={`${ic} w-64 pl-9`}
          />
        </div>
        <select value={industryFilter} onChange={e => { setIndustryFilter(e.target.value); setPage(1); }} className={`${ic} w-44`}>
          <option value="">All Industries</option>
          {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
        </select>
        {(search || industryFilter) && (
          <button
            onClick={() => { setSearch(''); setIndustryFilter(''); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <DataTable
        columns={cols}
        data={companies}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        keyExtractor={c => c.id}
        onRowClick={c => router.push(`/dashboard/companies/${c.id}`)}
        emptyMessage="No companies found"
      />
    </div>
  );
}
