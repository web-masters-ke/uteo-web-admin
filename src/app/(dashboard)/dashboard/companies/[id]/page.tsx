'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { DataTable, Column } from '@/components/DataTable';
import { companyService, AdminCompany } from '@/lib/services/companyService';
import { jobService, AdminJob } from '@/lib/services/jobService';
import { useToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();

  const [company, setCompany] = useState<AdminCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const fetchCompany = useCallback(async () => {
    try {
      const data = await companyService.get(params.id as string);
      setCompany(data);
    } catch {
      addToast('error', 'Failed to load company');
      router.push('/dashboard/companies');
    } finally {
      setLoading(false);
    }
  }, [params.id, addToast, router]);

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const data = await jobService.list({ companyId: params.id as string, limit: 20 });
      setJobs(data.items ?? []);
    } catch {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, [params.id]);

  useEffect(() => { fetchCompany(); fetchJobs(); }, [fetchCompany, fetchJobs]);

  const handleVerifyToggle = async () => {
    if (!company) return;
    setVerifyLoading(true);
    try {
      const updated = await companyService.verify(company.id, !company.isVerified);
      setCompany(updated);
      addToast('success', company.isVerified ? 'Company unverified' : 'Company verified');
    } catch {
      addToast('error', 'Failed to update verification');
    } finally {
      setVerifyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-12 bg-card rounded-xl border border-border" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="animate-pulse h-64 bg-card rounded-xl border border-border" />
          <div className="lg:col-span-2 animate-pulse h-64 bg-card rounded-xl border border-border" />
        </div>
      </div>
    );
  }

  if (!company) return null;

  const jobCols: Column<AdminJob>[] = [
    {
      key: 'title',
      label: 'Job Title',
      render: j => <span className="font-medium text-card-foreground">{j.title}</span>,
    },
    {
      key: 'jobType',
      label: 'Type',
      render: j => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-500/10 text-primary-500">
          {(j.jobType || '-').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'applications',
      label: 'Applicants',
      render: j => <span className="text-sm font-medium">{j._count?.applications ?? 0}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: j => <StatusBadge status={j.status} />,
    },
    {
      key: 'createdAt',
      label: 'Posted',
      render: j => <span className="text-muted-foreground text-sm">{formatDate(j.createdAt)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Company Details"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Companies', href: '/dashboard/companies' },
          { label: company.name },
        ]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleVerifyToggle}
              disabled={verifyLoading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                company.isVerified
                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                  : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
              }`}
            >
              {verifyLoading ? 'Saving...' : company.isVerified ? 'Unverify Company' : 'Verify Company'}
            </button>
            <button
              onClick={() => router.push('/dashboard/companies')}
              className="px-4 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors"
            >
              Back
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* ========== Company info card ========== */}
        <div className="space-y-5">
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <div className="w-16 h-16 rounded-xl bg-primary-500/10 flex items-center justify-center text-2xl font-bold text-primary-500 mx-auto mb-4">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                company.name[0]?.toUpperCase()
              )}
            </div>
            <h2 className="text-lg font-semibold text-card-foreground">{company.name}</h2>
            {company.industry && (
              <p className="text-sm text-muted-foreground mt-1">{company.industry}</p>
            )}
            <div className="flex justify-center mt-3">
              {company.isVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Unverified</span>
              )}
            </div>

            <div className="mt-5 space-y-2.5 text-sm text-left">
              {[
                ['Size', company.size || '-'],
                ['Location', company.location || '-'],
                ['Industry', company.industry || '-'],
                ['Jobs Posted', String(company._count?.jobs ?? 0)],
                ['Recruiters', String(company._count?.recruiters ?? 0)],
                ['Member Since', formatDate(company.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
              {company.website && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Website</span>
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline truncate max-w-[140px]">
                    {company.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {company.description && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold mb-2">About</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{company.description}</p>
            </div>
          )}

          {/* Verification actions */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-3">Verification</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {company.isVerified
                ? 'This company is verified. Job listings will display a verified badge.'
                : 'This company is not verified. Verify to indicate trustworthiness to job seekers.'}
            </p>
            <button
              onClick={handleVerifyToggle}
              disabled={verifyLoading}
              className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                company.isVerified
                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {verifyLoading ? 'Saving...' : company.isVerified ? 'Remove Verification' : 'Verify Company'}
            </button>
          </div>
        </div>

        {/* ========== Jobs + Recruiters ========== */}
        <div className="lg:col-span-2 space-y-6">
          {/* Jobs table */}
          <div>
            <h3 className="font-semibold mb-3">Job Postings ({company._count?.jobs ?? 0})</h3>
            <DataTable
              columns={jobCols}
              data={jobs}
              loading={jobsLoading}
              keyExtractor={j => j.id}
              onRowClick={j => router.push(`/dashboard/jobs/${j.id}`)}
              emptyMessage="No jobs posted yet"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
