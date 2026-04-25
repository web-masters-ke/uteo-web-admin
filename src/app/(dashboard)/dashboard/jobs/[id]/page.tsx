'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { jobService, AdminJob } from '@/lib/services/jobService';
import { applicationAdminService, AdminApplication } from '@/lib/services/applicationAdminService';
import { useToast } from '@/lib/toast';
import { formatDate, formatRelative } from '@/lib/utils';

const ic = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();

  const [job, setJob] = useState<AdminJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);

  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [delDialog, setDelDialog] = useState(false);
  const [delLoading, setDelLoading] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      const data = await jobService.get(params.id as string);
      setJob(data);
      setSelectedStatus(data.status);
    } catch {
      addToast('error', 'Failed to load job');
      router.push('/dashboard/jobs');
    } finally {
      setLoading(false);
    }
  }, [params.id, addToast, router]);

  const fetchApplications = useCallback(async () => {
    setAppsLoading(true);
    try {
      const data = await applicationAdminService.list({ jobId: params.id as string, limit: 10 });
      setApplications(data.items ?? []);
    } catch {
      setApplications([]);
    } finally {
      setAppsLoading(false);
    }
  }, [params.id]);

  useEffect(() => { fetchJob(); fetchApplications(); }, [fetchJob, fetchApplications]);

  const handleSaveStatus = async () => {
    if (!job || selectedStatus === job.status) return;
    setStatusSaving(true);
    try {
      const updated = await jobService.updateStatus(job.id, selectedStatus);
      setJob(updated);
      addToast('success', `Job status updated to ${selectedStatus}`);
    } catch {
      addToast('error', 'Failed to update status');
      setSelectedStatus(job.status);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!job) return;
    setDelLoading(true);
    try {
      await jobService.delete(job.id);
      addToast('success', 'Job deleted');
      router.push('/dashboard/jobs');
    } catch {
      addToast('error', 'Failed to delete job');
    } finally {
      setDelLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-12 bg-card rounded-xl border border-border" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 animate-pulse h-80 bg-card rounded-xl border border-border" />
          <div className="animate-pulse h-80 bg-card rounded-xl border border-border" />
        </div>
      </div>
    );
  }

  if (!job) return null;

  const salaryLabel =
    job.salaryMin || job.salaryMax
      ? `${job.salaryMin ? job.salaryMin.toLocaleString() : '?'} – ${job.salaryMax ? job.salaryMax.toLocaleString() : '?'}`
      : 'Not specified';

  return (
    <div>
      <PageHeader
        title="Job Details"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Jobs', href: '/dashboard/jobs' },
          { label: job.title },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push('/dashboard/jobs')}
              className="px-4 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setDelDialog(true)}
              className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm font-medium hover:bg-red-500/20 transition-colors"
            >
              Delete Job
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ========== LEFT: job content ========== */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title + meta */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-card-foreground">{job.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {job.company?.name}
                  {job.location ? ` · ${job.location}` : ''}
                  {job.jobType ? ` · ${job.jobType.replace(/_/g, ' ')}` : ''}
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Salary</p>
                <p className="font-medium mt-0.5">{salaryLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Posted</p>
                <p className="font-medium mt-0.5">{formatDate(job.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Posted by</p>
                <p className="font-medium mt-0.5 truncate">{job.postedBy?.email || '-'}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {job.description && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-3">Description</h3>
              <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {job.description}
              </div>
            </div>
          )}

          {/* Requirements */}
          {job.requirements && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-3">Requirements</h3>
              <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {job.requirements}
              </div>
            </div>
          )}

          {/* Skills */}
          {job.skills && job.skills.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-3">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill, i) => (
                  <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-500/10 text-primary-500">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent applicants */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Recent Applicants</h3>
              <span className="text-xs text-muted-foreground">{job._count?.applications ?? 0} total</span>
            </div>
            {appsLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse h-12 bg-muted rounded-lg" />
                ))}
              </div>
            ) : applications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <svg className="w-10 h-10 text-muted-foreground/40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-muted-foreground">No applications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {applications.map(app => (
                  <div key={app.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {app.user.firstName || app.user.lastName
                          ? `${app.user.firstName || ''} ${app.user.lastName || ''}`.trim()
                          : app.user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">{app.user.email} · {formatDate(app.appliedAt)}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========== RIGHT: sidebar controls ========== */}
        <div className="space-y-6">
          {/* Company info */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">Company</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-card-foreground">{job.company?.name || '-'}</span>
                {job.company?.isVerified && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>
              {job.company?.id && (
                <button
                  onClick={() => router.push(`/dashboard/companies/${job.company.id}`)}
                  className="text-xs text-primary-500 hover:text-primary-600 transition-colors"
                >
                  View company profile →
                </button>
              )}
            </div>
          </div>

          {/* Moderation controls */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">Moderation</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Status</label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className={ic}
                >
                  {['ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSaveStatus}
                disabled={statusSaving || selectedStatus === job.status}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {statusSaving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                    Saving...
                  </>
                ) : 'Save Status'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">Stats</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Applicants</span>
                <span className="font-semibold text-lg text-primary-500">{job._count?.applications ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Posted</span>
                <span className="font-medium">{formatDate(job.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Age</span>
                <span className="font-medium">{formatRelative(job.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{(job.jobType || '-').replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-card rounded-xl border border-red-200 dark:border-red-900/40 p-5">
            <h3 className="font-semibold text-red-600 dark:text-red-400 mb-3">Danger Zone</h3>
            <p className="text-xs text-muted-foreground mb-3">Permanently delete this job posting and all its applications.</p>
            <button
              onClick={() => setDelDialog(true)}
              className="w-full px-4 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm font-medium hover:bg-red-500/20 transition-colors"
            >
              Delete Job
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={delDialog}
        onClose={() => setDelDialog(false)}
        onConfirm={handleDelete}
        title="Delete Job"
        message={`Are you sure you want to delete "${job.title}"? This action cannot be undone and will remove all associated applications.`}
        confirmLabel="Delete Job"
        confirmVariant="danger"
        loading={delLoading}
      />
    </div>
  );
}
